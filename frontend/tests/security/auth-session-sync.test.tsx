// @vitest-environment jsdom
import React, { useContext } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ getMe: vi.fn() }));
vi.mock("../../src/lib/api/auth.api", () => ({ authApi: { getMe: mocks.getMe } }));
import { AuthProvider } from "../../src/providers/AuthProvider";
import { AuthContext } from "../../src/context/AuthContext";
import { ApiError } from "../../src/lib/api/client";

function Identity() {
  const context = useContext(AuthContext);
  return <span>{context?.user?.email || "signed out"}</span>;
}
describe("cross-tab notification identity compatibility", () => {
  afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });
  it.each([new ApiError(503, "Session verification unavailable"), new TypeError("Network unavailable")])(
    "preserves credentials on temporary failure without granting an unverified initial identity", async (error) => {
      localStorage.setItem("access_token", "session-a");
      localStorage.setItem("refresh_token", "refresh-a");
      mocks.getMe.mockRejectedValueOnce(error);
      render(<AuthProvider><Identity /></AuthProvider>);
      await waitFor(() => expect(mocks.getMe).toHaveBeenCalledOnce());
      await act(async () => {});
      expect(localStorage.getItem("access_token")).toBe("session-a");
      expect(localStorage.getItem("refresh_token")).toBe("refresh-a");
      expect(screen.getByText("signed out")).toBeDefined();
    });
  it.each([401, 403])("clears credentials after confirmed HTTP %s", async (status) => {
    localStorage.setItem("access_token", "session-a");
    localStorage.setItem("refresh_token", "refresh-a");
    mocks.getMe.mockRejectedValueOnce(new ApiError(status, "Access denied"));
    render(<AuthProvider><Identity /></AuthProvider>);
    await waitFor(() => expect(localStorage.getItem("access_token")).toBeNull());
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });
  it("reloads the identity after another tab replaces credentials, then clears it on logout", async () => {
    localStorage.setItem("access_token", "session-a");
    mocks.getMe.mockResolvedValueOnce({ id: "a", email: "first@example.test", role: "APPLICANT" });
    render(<AuthProvider><Identity /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("first@example.test")).toBeDefined());
    localStorage.setItem("access_token", "session-b");
    mocks.getMe.mockResolvedValueOnce({ id: "b", email: "second@example.test", role: "APPLICANT" });
    window.dispatchEvent(new StorageEvent("storage", { key: "access_token", newValue: "session-b" }));
    await waitFor(() => expect(screen.getByText("second@example.test")).toBeDefined());
    expect(mocks.getMe).toHaveBeenCalledTimes(2);
    localStorage.removeItem("access_token");
    window.dispatchEvent(new StorageEvent("storage", { key: "access_token", newValue: null }));
    await waitFor(() => expect(screen.getByText("signed out")).toBeDefined());
  });
  it("ignores an old session response which finishes after a token replacement", async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    localStorage.setItem("access_token", "session-a");
    mocks.getMe.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
    render(<AuthProvider><Identity /></AuthProvider>);
    await waitFor(() => expect(mocks.getMe).toHaveBeenCalledOnce());
    mocks.getMe.mockResolvedValueOnce({ id: "b", email: "second@example.test", role: "APPLICANT" });
    localStorage.setItem("access_token", "session-b");
    window.dispatchEvent(new StorageEvent("storage", { key: "access_token", newValue: "session-b" }));
    await waitFor(() => expect(screen.getByText("second@example.test")).toBeDefined());
    await act(async () => { resolveFirst({ id: "a", email: "first@example.test", role: "APPLICANT" }); });
    expect(screen.getByText("second@example.test")).toBeDefined();
    expect(screen.queryByText("first@example.test")).toBeNull();
  });
});
