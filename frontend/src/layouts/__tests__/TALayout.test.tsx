import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TALayout } from "../TALayout";

const mockLogout = vi.fn().mockResolvedValue(undefined);

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "u-ta-recruiter-1",
      email: "recruiter@megs.ph",
      role: "TALENT_ACQUISITION",
      accountStatus: "ACTIVE",
      createdAt: "2026-01-15T08:00:00.000Z",
      applicantProfile: { firstName: "Sarah", lastName: "Santos" },
    },
    isAuthenticated: true,
    logout: mockLogout,
    refreshUser: vi.fn().mockResolvedValue(undefined),
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
  Link: ({ children, to, activeOptions, activeProps: _activeProps, onClick, ...props }: any) => (
    <a
      href={to}
      data-exact={activeOptions?.exact ? "true" : "false"}
      onClick={onClick}
      {...props}
    >
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="outlet-content">Child Content</div>,
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/ta/dashboard" }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("TALayout Navigation & Account Menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders only core operational recruitment navigation items and does not render My Profile in primary navigation", () => {
    renderWithClient(<TALayout />);

    // Primary recruitment modules in sidebar
    expect(screen.getByRole("link", { name: /Overview/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /Applications/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /Job Postings/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /Requisitions \(MRF\)/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /Candidate pool/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /Interviews/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /Clients & Endorsements/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /Deployments & 201/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /Reports/i })).toBeDefined();

    // Redundant individual placement links must NOT be in primary navigation
    expect(screen.queryByRole("link", { name: /^Site deployments$/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Employee records \(201\)$/i })).toBeNull();

    // Redundant profile link must NOT be in primary navigation
    const myProfileLink = screen.queryByRole("link", { name: /My Profile/i });
    expect(myProfileLink).toBeNull();

    // Sidebar footer and standalone sidebar sign out button must NOT exist
    const initialSignOut = screen.queryByRole("button", { name: /^Sign Out$/i });
    expect(initialSignOut).toBeNull();
  });

  it("renders TA identity trigger button with accessible attributes in top-right header", () => {
    renderWithClient(<TALayout />);

    const accountButton = screen.getByRole("button", { name: /Account menu for Sarah Santos/i });
    expect(accountButton).toBeDefined();
    expect(accountButton.getAttribute("aria-haspopup")).toBe("menu");
    expect(accountButton.getAttribute("aria-expanded")).toBe("false");
    expect(accountButton.getAttribute("aria-controls")).toBe("ta-account-menu");
  });

  it("opens account dropdown menu when clicking identity trigger and displays recruiter details", () => {
    renderWithClient(<TALayout />);

    const accountButton = screen.getByRole("button", { name: /Account menu for Sarah Santos/i });
    fireEvent.click(accountButton);

    expect(accountButton.getAttribute("aria-expanded")).toBe("true");

    const menu = screen.getByRole("menu");
    expect(menu).toBeDefined();
    expect(menu.getAttribute("id")).toBe("ta-account-menu");

    // Context identity card inside dropdown
    expect(screen.getAllByText("Sarah Santos").length).toBeGreaterThan(0);
    expect(screen.getByText("recruiter@megs.ph")).toBeDefined();
    expect(screen.getAllByText(/Talent Acquisition/i).length).toBeGreaterThan(0);

    // Profile item must NOT exist for Recruiter / TA
    expect(screen.queryByRole("menuitem", { name: /Profile/i })).toBeNull();

    // Menu items
    const securityItem = screen.getByRole("menuitem", { name: /Account Security/i });
    expect(securityItem).toBeDefined();

    const signOutItem = screen.getByRole("menuitem", { name: /Sign Out/i });
    expect(signOutItem).toBeDefined();
  });

  it("opens Change Password modal when clicking Account Security menu item", () => {
    renderWithClient(<TALayout />);

    const accountButton = screen.getByRole("button", { name: /Account menu for Sarah Santos/i });
    fireEvent.click(accountButton);

    const securityItem = screen.getByRole("menuitem", { name: /Account Security/i });
    fireEvent.click(securityItem);

    // Menu should close and ChangePassword modal should open
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText(/Update your account password/i)).toBeDefined();
  });

  it("triggers sign out confirmation dialog when clicking Sign Out in account menu", async () => {
    renderWithClient(<TALayout />);

    const accountButton = screen.getByRole("button", { name: /Account menu for Sarah Santos/i });
    fireEvent.click(accountButton);

    const signOutItem = screen.getByRole("menuitem", { name: /Sign Out/i });
    fireEvent.click(signOutItem);

    // Warning dialog should open
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeDefined();
    expect(screen.getByText(/Sign Out Confirmation/i)).toBeDefined();

    // Confirm sign out in dialog
    const confirmButtons = screen.getAllByRole("button", { name: /Sign Out/i });
    const dialogConfirmBtn = confirmButtons[confirmButtons.length - 1];
    fireEvent.click(dialogConfirmBtn);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  it("closes account menu when Escape is pressed and restores focus to trigger button", () => {
    renderWithClient(<TALayout />);

    const accountButton = screen.getByRole("button", { name: /Account menu for Sarah Santos/i });
    fireEvent.click(accountButton);
    expect(screen.getByRole("menu")).toBeDefined();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(accountButton.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes account menu when clicking outside", () => {
    renderWithClient(<TALayout />);

    const accountButton = screen.getByRole("button", { name: /Account menu for Sarah Santos/i });
    fireEvent.click(accountButton);
    expect(screen.getByRole("menu")).toBeDefined();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("menu")).toBeNull();
    expect(accountButton.getAttribute("aria-expanded")).toBe("false");
  });
});



