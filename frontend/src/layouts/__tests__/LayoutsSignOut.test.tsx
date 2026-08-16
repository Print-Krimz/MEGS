import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminLayout } from "../AdminLayout";
import { ApplicantLayout } from "../ApplicantLayout";
import { TALayout } from "../TALayout";

const mockLogout = vi.fn().mockResolvedValue(undefined);

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "u-1",
      email: "user@megs.ph",
      role: "ADMINISTRATOR",
      applicantProfile: { firstName: "Jane", lastName: "Doe" },
    },
    isAuthenticated: true,
    logout: mockLogout,
  }),
}));

vi.mock("../../hooks/useRealtimeNotifications", () => ({
  useRealtimeNotifications: () => ({
    unreadCount: 0,
    notifications: [],
    markAsRead: vi.fn(),
    activeToasts: [],
    dismissToast: vi.fn(),
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  Outlet: () => <div data-testid="outlet-content">Child Content</div>,
  useNavigate: () => vi.fn(),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("Layout Sign Out Warnings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AdminLayout", () => {
    it("opens sign out warning when clicking sign out button and triggers logout on confirmation", async () => {
      renderWithClient(<AdminLayout />);

      // Warning dialog should initially be closed
      expect(screen.queryByText(/Sign Out Confirmation/i)).toBeNull();

      // Click sign out button in sidebar
      const signOutButton = screen.getByRole("button", { name: /Sign Out/i });
      fireEvent.click(signOutButton);

      // Warning dialog should now be open
      expect(screen.getByText(/Sign Out Confirmation/i)).toBeDefined();
      expect(screen.getByText(/Are you sure you want to sign out\?/i)).toBeDefined();

      // Confirm sign out
      const confirmButton = screen.getAllByRole("button", { name: /Sign Out/i })[1];
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("ApplicantLayout", () => {
    it("opens sign out warning when clicking sign out button and triggers logout on confirmation", async () => {
      renderWithClient(<ApplicantLayout />);

      // Warning dialog should initially be closed
      expect(screen.queryByText(/Sign Out Confirmation/i)).toBeNull();

      // Click sign out button in navbar
      const signOutButton = screen.getByRole("button", { name: /Sign Out/i });
      fireEvent.click(signOutButton);

      // Warning dialog should now be open
      expect(screen.getByText(/Sign Out Confirmation/i)).toBeDefined();

      // Confirm sign out
      const confirmButton = screen.getAllByRole("button", { name: /Sign Out/i })[1];
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("TALayout", () => {
    it("opens sign out warning when clicking sign out button and cancels when cancel is clicked", async () => {
      renderWithClient(<TALayout />);

      // Warning dialog should initially be closed
      expect(screen.queryByText(/Sign Out Confirmation/i)).toBeNull();

      // Click sign out button in sidebar
      const signOutButton = screen.getByRole("button", { name: /Sign Out/i });
      fireEvent.click(signOutButton);

      // Warning dialog should now be open
      expect(screen.getByText(/Sign Out Confirmation/i)).toBeDefined();

      // Click cancel
      const cancelButton = screen.getByRole("button", { name: /Cancel/i });
      fireEvent.click(cancelButton);

      // Dialog should close without calling logout
      await waitFor(() => {
        expect(screen.queryByText(/Sign Out Confirmation/i)).toBeNull();
        expect(mockLogout).not.toHaveBeenCalled();
      });
    });
  });
});
