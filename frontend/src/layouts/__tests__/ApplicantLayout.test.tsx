import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApplicantLayout } from "../ApplicantLayout";

const mockLogout = vi.fn().mockResolvedValue(undefined);
let mockPathname = "/app";

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "u-applicant-1",
      email: "applicant@megs.ph",
      role: "APPLICANT",
      applicantProfile: { firstName: "Juan", lastName: "Dela Cruz" },
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
  Link: ({ children, to, activeOptions, activeProps, inactiveProps: _inactiveProps, onClick, ...props }: any) => (
    <a
      href={to}
      data-exact={activeOptions?.exact ? "true" : "false"}
      data-active-class={activeProps?.className}
      onClick={onClick}
      {...props}
    >
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="outlet-content">Child Content</div>,
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: mockPathname }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("ApplicantLayout Navigation & Account Menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/app";
  });

  it("renders primary recruitment navigation items including My Profile", () => {
    renderWithClient(<ApplicantLayout />);

    // Primary recruitment links
    expect(screen.getByRole("link", { name: /Dashboard/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /Browse Jobs/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /My Applications/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /My Profile/i })).toBeDefined();
  });

  it("renders applicant identity trigger button with accessible attributes", () => {
    renderWithClient(<ApplicantLayout />);

    const accountButton = screen.getByRole("button", { name: /Account menu/i });
    expect(accountButton).toBeDefined();
    expect(accountButton.getAttribute("aria-haspopup")).toBe("menu");
    expect(accountButton.getAttribute("aria-expanded")).toBe("false");
    expect(accountButton.getAttribute("aria-controls")).toBe("applicant-account-menu");
  });

  it("opens account dropdown menu when clicking identity trigger and displays user details", () => {
    renderWithClient(<ApplicantLayout />);

    const accountButton = screen.getByRole("button", { name: /Account menu/i });
    fireEvent.click(accountButton);

    expect(accountButton.getAttribute("aria-expanded")).toBe("true");

    const menu = screen.getByRole("menu");
    expect(menu).toBeDefined();
    expect(menu.getAttribute("id")).toBe("applicant-account-menu");

    // Context details inside dropdown header
    expect(screen.getAllByText("Juan Dela Cruz").length).toBeGreaterThan(0);
    expect(screen.getByText("applicant@megs.ph")).toBeDefined();

    // Menu options
    const profileItem = screen.getByRole("menuitem", { name: /Profile/i });
    expect(profileItem).toBeDefined();
    expect(profileItem.getAttribute("href")).toBe("/app/profile");

    const settingsItem = screen.getByRole("menuitem", { name: /Settings/i });
    expect(settingsItem.getAttribute("href")).toBe("/app/settings");

    const signOutItem = screen.getByRole("menuitem", { name: /Sign Out|Logout/i });
    expect(signOutItem).toBeDefined();
  });

  it("navigates to Settings when clicking the account menu item and closes dropdown", () => {
    renderWithClient(<ApplicantLayout />);

    const accountButton = screen.getByRole("button", { name: /Account menu/i });
    fireEvent.click(accountButton);

    const settingsItem = screen.getByRole("menuitem", { name: /Settings/i });
    fireEvent.click(settingsItem);

    // Password management now lives on Settings.
    expect(screen.queryByRole("menu")).toBeNull();
    expect(settingsItem.getAttribute("href")).toBe("/app/settings");
  });

  it("navigates to Profile page when clicking Profile menu item and closes dropdown", () => {
    renderWithClient(<ApplicantLayout />);

    const accountButton = screen.getByRole("button", { name: /Account menu/i });
    fireEvent.click(accountButton);

    const profileItem = screen.getByRole("menuitem", { name: /Profile/i });
    fireEvent.click(profileItem);

    // Menu should close
    expect(screen.queryByRole("menu")).toBeNull();
    expect(accountButton.getAttribute("aria-expanded")).toBe("false");
  });

  it("triggers sign out confirmation dialog when clicking Sign Out in account menu", async () => {
    renderWithClient(<ApplicantLayout />);

    const accountButton = screen.getByRole("button", { name: /Account menu/i });
    fireEvent.click(accountButton);

    const signOutItem = screen.getByRole("menuitem", { name: /Sign Out|Logout/i });
    fireEvent.click(signOutItem);

    // Warning dialog should open
    expect(screen.getByText(/Sign Out Confirmation/i)).toBeDefined();

    // Confirm sign out
    const confirmButton = screen.getAllByRole("button", { name: /Sign Out/i })[0];
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  it("closes account menu when Escape is pressed and refocuses trigger", () => {
    renderWithClient(<ApplicantLayout />);

    const accountButton = screen.getByRole("button", { name: /Account menu/i });
    fireEvent.click(accountButton);
    expect(screen.getByRole("menu")).toBeDefined();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(accountButton.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes account menu when clicking outside", () => {
    renderWithClient(<ApplicantLayout />);

    const accountButton = screen.getByRole("button", { name: /Account menu/i });
    fireEvent.click(accountButton);
    expect(screen.getByRole("menu")).toBeDefined();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("menu")).toBeNull();
    expect(accountButton.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders My Documents nav link, typographic MEGS brand lockup without logo image, and Company Home footer link", () => {
    renderWithClient(<ApplicantLayout />);

    const docsLink = screen.getByRole("link", { name: /My Documents/i });
    expect(docsLink.getAttribute("href")).toBe("/app/documents");

    const companyHomeLink = screen.getByRole("link", { name: /Company Home/i });
    expect(companyHomeLink.getAttribute("href")).toBe("/");
    expect(companyHomeLink.className).toContain("min-h-11");

    const portalHomeLink = screen.getByRole("link", { name: /MEGS Candidate Portal Home/i });
    expect(portalHomeLink.getAttribute("href")).toBe("/app");
    expect(portalHomeLink.querySelector("svg")).toBeNull();
    expect(portalHomeLink.querySelector("img")).toBeNull();
    expect(portalHomeLink.textContent).toContain("MEGS");
  });

  it("opens mobile drawer with 44px minimum tap targets", () => {
    const { container } = renderWithClient(<ApplicantLayout />);

    const toggleBtn = screen.getByRole("button", { name: /Open menu/i });
    expect(toggleBtn.className).toContain("min-h-11");
    fireEvent.click(toggleBtn);

    const mobileMenu = container.querySelector("#applicant-mobile-menu");
    expect(mobileMenu).not.toBeNull();
    const drawerLinks = mobileMenu!.querySelectorAll("a");
    expect(drawerLinks.length).toBe(5);
    drawerLinks.forEach((link) => {
      expect(link.className).toContain("min-h-11");
    });
  });

  it("highlights Browse Jobs when viewing /app/recommended", () => {
    mockPathname = "/app/recommended";
    renderWithClient(<ApplicantLayout />);

    const browseLink = screen.getByRole("link", { name: /Browse Jobs/i });
    const dashboardLink = screen.getByRole("link", { name: /Dashboard/i });
    expect(browseLink.getAttribute("aria-current")).toBe("page");
    expect(browseLink.className).toContain("bg-[#EAF0F7]");
    expect(dashboardLink.getAttribute("aria-current")).toBeNull();
  });
});
