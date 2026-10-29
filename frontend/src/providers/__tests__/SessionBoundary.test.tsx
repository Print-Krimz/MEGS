// @vitest-environment jsdom
import React, { useContext } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
const mocks = vi.hoisted(() => ({ getMe: vi.fn(), logout: vi.fn() }));
vi.mock("../../lib/api/auth.api", () => ({ authApi: { getMe: mocks.getMe, logout: mocks.logout } }));
import { AuthProvider } from "../AuthProvider";
import { QueryProvider } from "../QueryProvider";
import { AuthContext } from "../../context/AuthContext";
import { getSessionGeneration, bumpSessionGeneration } from "../../lib/auth/session-generation";

// Node 26 ships its own localStorage that can shadow jsdom's; use a plain in-memory store.
const memoryStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
};
let data = "A-private";
function Probe() {
  const auth = useContext(AuthContext)!;
  const q = useQuery({ queryKey: ["private"], queryFn: async () => data });
  const qc = useQueryClient();
  return (
    <div>
      <span>{q.data ?? "none"}</span>
      <button onClick={() => auth.login({ access_token: "b", refresh_token: "rb", user: { id: "b" } } as never)}>login-b</button>
      <button onClick={() => localStorage.setItem("access_token", "refreshed")}>refresh</button>
      <button onClick={() => void qc.invalidateQueries()}>noop</button>
    </div>
  );
}
const jwt = (sub: string, n: string) => `h.${btoa(JSON.stringify({ sub, n }))}.s`;
const mount = () => render(<QueryProvider><AuthProvider><Probe /></AuthProvider></QueryProvider>);

describe("session boundary", () => {
  beforeEach(() => { vi.stubGlobal("localStorage", memoryStorage()); });
  afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); data = "A-private"; });

  it("account switch clears A's cache before B renders", async () => {
    localStorage.setItem("access_token", "a");
    mocks.getMe.mockResolvedValue({ id: "a" });
    mount();
    await waitFor(() => expect(screen.getByText("A-private")).toBeDefined());
    data = "B-private";
    await act(async () => { screen.getByText("login-b").click(); });
    expect(screen.queryByText("A-private")).toBeNull();
    await waitFor(() => expect(screen.getByText("B-private")).toBeDefined());
  });

  it("token refresh keeps the generation and cached data", async () => {
    localStorage.setItem("access_token", "a");
    mocks.getMe.mockResolvedValue({ id: "a" });
    mount();
    await waitFor(() => expect(screen.getByText("A-private")).toBeDefined());
    const gen = getSessionGeneration();
    data = "changed";
    await act(async () => { screen.getByText("refresh").click(); });
    expect(getSessionGeneration()).toBe(gen);
    expect(screen.getByText("A-private")).toBeDefined();
  });

  it("generation bump with no credentials settles loading", async () => {
    localStorage.setItem("access_token", "a");
    mocks.getMe.mockImplementation(() => new Promise(() => {}));
    function L() { return <span>{useContext(AuthContext)?.isLoading ? "loading" : "settled"}</span>; }
    render(<QueryProvider><AuthProvider><L /></AuthProvider></QueryProvider>);
    expect(screen.getByText("loading")).toBeDefined();
    localStorage.removeItem("access_token");
    await act(async () => { bumpSessionGeneration(); });
    expect(screen.getByText("settled")).toBeDefined();
  });

  it("cross-tab refresh of the same account keeps caches; a different account clears them", async () => {
    const t1 = jwt("u1", "1");
    localStorage.setItem("access_token", t1);
    mocks.getMe.mockResolvedValue({ id: "u1" });
    mount();
    await waitFor(() => expect(screen.getByText("A-private")).toBeDefined());
    const gen = getSessionGeneration();
    data = "changed";
    const t2 = jwt("u1", "2");
    localStorage.setItem("access_token", t2);
    await act(async () => { window.dispatchEvent(new StorageEvent("storage", { key: "access_token", oldValue: t1, newValue: t2 })); });
    expect(getSessionGeneration()).toBe(gen);
    expect(screen.getByText("A-private")).toBeDefined();
    const t3 = jwt("u2", "3");
    localStorage.setItem("access_token", t3);
    await act(async () => { window.dispatchEvent(new StorageEvent("storage", { key: "access_token", oldValue: t2, newValue: t3 })); });
    expect(getSessionGeneration()).toBe(gen + 1);
    await waitFor(() => expect(screen.getByText("changed")).toBeDefined());
  });
});
