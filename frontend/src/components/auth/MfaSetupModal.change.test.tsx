import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MfaSetupModal } from "./MfaSetupModal";
vi.mock("../../hooks/useSecurityControls", () => ({ useSecurityControls: () => ({ data: { mfaDisabled: false } }) }));
vi.mock("../../lib/feedback", () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() }, formatErrorMessage: (e: Error) => e.message }));
describe("custom MFA setup", () => {
  it("uses the supplied enrollment and verification and finishes with the new session", async () => {
    const enroll = vi.fn().mockResolvedValue({ factorId: "new", qrCode: "data:image/png;base64,AA", secret: "secret" });
    const verify = vi.fn().mockResolvedValue({ recoveryCodes: ["ABCD-EFGH"], access_token: "new-token", user: { id: "u" } });
    const onSuccess = vi.fn();
    render(<MfaSetupModal open onClose={vi.fn()} tempToken="token" email="staff@example.com" enroll={enroll} verify={verify} finishLabel="Done" onSuccess={onSuccess} />);
    await waitFor(() => expect(enroll).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText(/Enter the 6-digit code from your app/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify and turn on/i }));
    await waitFor(() => expect(verify).toHaveBeenCalledWith("new", "123456"));
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ access_token: "new-token" }));
  });
  it("finishes immediately without a backup step when existing codes stay valid", async () => {
    const enroll = vi.fn().mockResolvedValue({ factorId: "new", qrCode: "data:image/png;base64,AA", secret: "secret" });
    const verify = vi.fn().mockResolvedValue({ oldRemoved: true, access_token: "new-token", user: { id: "u" } });
    const onSuccess = vi.fn();
    render(<MfaSetupModal open onClose={vi.fn()} tempToken="token" email="staff@example.com" enroll={enroll} verify={verify} onSuccess={onSuccess} />);
    await waitFor(() => expect(enroll).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/Enter the 6-digit code from your app/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify and turn on/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ oldRemoved: true })));
    expect(screen.queryByText(/Save your emergency backup codes/i)).toBeNull();
  });
});
