import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminLayout } from "../AdminLayout";

const identity = vi.hoisted(() => ({ unnamed: false }));
const mockLogout = vi.fn().mockResolvedValue(undefined);

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "u-admin-super-1",
      email: "chief.admin@megs.ph",
      role: "ADMINISTRATOR",
      displayName: identity.unnamed ? null : "Alex Admin",
      accountStatus: "ACTIVE",
      createdAt: "2026-01-10T08:00:00.000Z",
      applicantProfile: identity.unnamed ? null : { firstName: "Chief", lastName: "Admin" },
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
  useLocation: () => ({ pathname: "/admin/scoring" }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("AdminLayout Navigation & Account Menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identity.unnamed = false;
  });

  it("uses role initials and shows email once in the menu when unnamed", () => {
    identity.unnamed = true;
    renderWithClient(<AdminLayout />);
    const button = screen.getByRole("button", { name: "Account menu for chief.admin@megs.ph" });
    expect(button).toHaveTextContent("AD");
    fireEvent.click(button);
    expect(screen.getByRole("menu").textContent?.split("chief.admin@megs.ph")).toHaveLength(2);
  });

  it("renders Admin identity trigger button with accessible attributes in top-right header", () => {
    renderWithClient(<AdminLayout />);

    const accountButton = screen.getByRole("button", { name: /Account menu for Alex Admin/i });
    expect(accountButton).toBeDefined();
    expect(accountButton.getAttribute("aria-haspopup")).toBe("menu");
    expect(accountButton.getAttribute("aria-expanded")).toBe("false");
    expect(accountButton.getAttribute("aria-controls")).toBe("admin-account-menu");
    expect(accountButton).toHaveTextContent("AA");
  });

  it("opens account dropdown menu when clicking identity trigger and displays administrator details", () => {
    renderWithClient(<AdminLayout />);

    const accountButton = screen.getByRole("button", { name: /Account menu for Alex Admin/i });
    fireEvent.click(accountButton);

    expect(accountButton.getAttribute("aria-expanded")).toBe("true");

    const menu = screen.getByRole("menu");
    expect(menu).toBeDefined();
    expect(menu.getAttribute("id")).toBe("admin-account-menu");

    // Context identity card inside dropdown
    expect(screen.getAllByText("Alex Admin").length).toBeGreaterThan(0);
    expect(screen.getByText("chief.admin@megs.ph")).toBeDefined();
    expect(screen.getAllByText(/Administrator/i).length).toBeGreaterThan(0);

    // Profile item must NOT exist for Admin
    expect(screen.queryByRole("menuitem", { name: /Profile/i })).toBeNull();

    // Menu items
    const settingsItem = screen.getByRole("menuitem", { name: /Settings/i });
    expect(settingsItem.getAttribute("href")).toBe("/admin/settings");
    expect(screen.queryByRole("menuitem", { name: /Change password/i })).toBeNull();

    const signOutItem = screen.getByRole("menuitem", { name: /Sign Out/i });
    expect(signOutItem).toBeDefined();
  });

  it("navigates to Settings when clicking the account menu item", () => {
    renderWithClient(<AdminLayout />);

    const accountButton = screen.getByRole("button", { name: /Account menu for Alex Admin/i });
    fireEvent.click(accountButton);

    const settingsItem = screen.getByRole("menuitem", { name: /Settings/i });
    fireEvent.click(settingsItem);

    // Menu closes and password management now lives on Settings.
    expect(screen.queryByRole("menu")).toBeNull();
    expect(settingsItem.getAttribute("href")).toBe("/admin/settings");
  });

});
