// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), continue: vi.fn() }));
vi.mock("../../src/lib/api/client", () => ({ ApiError: class extends Error {}, api: { get: mocks.get, patch: mocks.patch } }));
vi.mock("../../src/lib/api/auth.api", () => ({ authApi: { continueWithoutMfa: mocks.continue } }));
import { MfaDisabledContinuation } from "../../src/components/auth/MfaDisabledContinuation";

let client: QueryClient;
let current: { mfaDisabled: boolean; otpDisabled: boolean; rateLimitDisabled: boolean };
function mount(node: React.ReactNode) {
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}
describe("hosted demo security UI", () => {
  beforeEach(() => {
    vi.clearAllMocks(); client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    current = { mfaDisabled: false, otpDisabled: false, rateLimitDisabled: false };
    mocks.get.mockImplementation(async () => ({ ...current }));
  });
  afterEach(() => { cleanup(); client.clear(); });
  it("shows no continuation or switch when the developer has MFA enabled", async () => {
    mount(<MfaDisabledContinuation token="existing" open onSuccess={vi.fn()} />);
    await waitFor(() => expect(mocks.get).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Continue without MFA" })).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(mocks.patch).not.toHaveBeenCalled();
  });
  it("continues pending MFA only after a successful server response", async () => {
    current.mfaDisabled = true;
    const session = { access_token: "existing", user: { id: "staff" } };
    mocks.continue.mockResolvedValue(session); const success = vi.fn();
    mount(<MfaDisabledContinuation token="existing" open onSuccess={success} />);
    fireEvent.click(await screen.findByRole("button", { name: "Continue without MFA" }));
    await waitFor(() => expect(success).toHaveBeenCalledWith(session));
    expect(mocks.continue).toHaveBeenCalledWith("existing");
  });
  it("does not complete login if MFA was re-enabled between rendering and submitting", async () => {
    current.mfaDisabled = true;
    mocks.continue.mockRejectedValue(new Error("Multi-factor authentication is required")); const success = vi.fn();
    mount(<MfaDisabledContinuation token="existing" open onSuccess={success} />);
    fireEvent.click(await screen.findByRole("button", { name: "Continue without MFA" }));
    await screen.findByRole("alert"); expect(success).not.toHaveBeenCalled();
  });
});
