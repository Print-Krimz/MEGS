import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SignOutDialog } from "../SignOutDialog";

const mockLogout = vi.fn().mockResolvedValue(undefined);

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "test@megs.ph", role: "ADMINISTRATOR" },
    isAuthenticated: true,
    logout: mockLogout,
  }),
}));

describe("SignOutDialog Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when open is false", () => {
    render(<SignOutDialog open={false} onClose={vi.fn()} />);
    expect(screen.queryByText(/Sign Out Confirmation/i)).toBeNull();
  });

  it("renders sign out warning when open is true", () => {
    render(<SignOutDialog open={true} onClose={vi.fn()} />);

    expect(screen.getByText(/Sign Out Confirmation/i)).toBeDefined();
    expect(
      screen.getByText(/Are you sure you want to sign out\? Any unsaved changes will be lost/i)
    ).toBeDefined();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Sign Out/i })).toBeDefined();
  });

  it("calls onClose when Cancel button is clicked", () => {
    const handleClose = vi.fn();
    render(<SignOutDialog open={true} onClose={handleClose} />);

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("calls logout from useAuth and closes dialog on confirm", async () => {
    const handleClose = vi.fn();
    render(<SignOutDialog open={true} onClose={handleClose} />);

    const confirmButton = screen.getByRole("button", { name: /Sign Out/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  it("calls custom onConfirm prop if provided", async () => {
    const handleClose = vi.fn();
    const handleCustomConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <SignOutDialog
        open={true}
        onClose={handleClose}
        onConfirm={handleCustomConfirm}
      />
    );

    const confirmButton = screen.getByRole("button", { name: /Sign Out/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(handleCustomConfirm).toHaveBeenCalledTimes(1);
      expect(mockLogout).not.toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});
