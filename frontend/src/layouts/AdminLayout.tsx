import React, { useState, useRef, useEffect } from "react";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users2,
  Sliders,
  Activity,
  History,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Settings,
  Menu,
  X,
  Database,
  Building2,
  ClipboardList,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { useIdleSignOut } from "../hooks/useIdleSignOut";
import {
  IdleWarningDialog,
  NotificationBell,
  RealtimeToastContainer,
  SignOutDialog,
} from "../components/common";
import { adminApi } from "../lib/api/admin.api";
import { TA_COPY } from "../lib/ta-copy";
import { getInitials } from "../lib/utils";
import { resolveUserName } from "../lib/user-name";
import { AdminGlobalSearch } from "./AdminGlobalSearch";
import "./admin.css";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: { count: number; label: string; tone?: "action" | "info" };
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const SIDEBAR_STORAGE_KEY = "megs_sidebar_collapsed";

const SEARCH_HINT =
  typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform ?? "") ? "\u2318 K" : "Ctrl K";

function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function isAdminNavItemActive(pathname: string, to: string): boolean {
  if (to === "/admin") return pathname === "/admin";
  if (to === "/admin/scoring") return pathname === "/admin/scoring";
  if (to === "/admin/analytics") {
    return pathname.startsWith("/admin/analytics") || pathname.startsWith("/admin/applications/");
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

const BrandLockup: React.FC<{ compact?: boolean }> = ({ compact = false }) =>
  compact ? null : (
    <div className="flex min-w-0 items-center">
      <span className="truncate text-sm font-semibold leading-tight text-white">Administration</span>
    </div>
  );

const AdminNavList: React.FC<{
  sections: NavSection[];
  isActive: (to: string) => boolean;
  size: "md" | "lg";
  collapsed?: boolean;
  onNavigate?: () => void;
}> = ({ sections, isActive, size, collapsed = false, onNavigate }) => (
  <nav
    aria-label="Admin portal"
    className={`flex-1 overflow-y-auto py-3 space-y-5 ${size === "lg" ? "px-3" : "px-2"}`}
  >
    {sections.map((section) => (
      <div key={section.label} className="space-y-1">
        {!collapsed && (
          <div className="px-3 text-[11px] font-medium uppercase tracking-wide text-white/70">
            {section.label}
          </div>
        )}
        <div className="space-y-0.5">
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            const count = item.badge?.count ?? 0;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={`focus-ring-dark relative flex items-center gap-2.5 border-l-[3px] px-3 py-2 text-sm transition-colors ${
                  size === "lg" ? "min-h-11" : "min-h-10"
                } ${
                  active
                    ? "border-megs-red bg-white/5 font-medium text-white"
                    : "border-transparent text-white/75 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                {count > 0 && (
                  <>
                    <span
                      aria-hidden="true"
                      className={`rounded-full px-1.5 text-xs font-semibold leading-5 tabular-nums ${
                        item.badge?.tone === "info" ? "bg-white/15 text-white" : "bg-white text-megs-red"
                      } ${collapsed ? "absolute right-0.5 top-0.5 min-w-5 text-center text-[10px] leading-4" : "ml-auto"}`}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                    <span className="sr-only">{item.badge?.label}</span>
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    ))}
  </nav>
);

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const idle = useIdleSignOut();
  useEffect(() => {
    if (idle.expired) void logout({ reason: "idle" });
  }, [idle.expired, logout]);
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const menuItemsRef = useRef<(HTMLAnchorElement | HTMLButtonElement | null)[]>([]);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLElement>(null);

  const [bellOpen, setBellOpen] = useState(false);
  const {
    unreadCount,
    notifications,
    notificationsLoading,
    markAsRead,
    activeToasts,
    dismissToast,
    handleToastClick,
  } = useRealtimeNotifications({ recentEnabled: bellOpen });

  const userSummary = useQuery({
    queryKey: ["admin", "users", "summary"],
    queryFn: ({ signal }) => adminApi.getUserSummary({ signal }),
    staleTime: 60_000,
  }).data;
  const expiredInvitations = userSummary?.expiredInvitations ?? 0;
  const failedJobs = userSummary?.failedJobs ?? 0;

  const adminNavSections: NavSection[] = [
    {
      label: "Overview",
      items: [
        { to: "/admin", label: "Overview", icon: LayoutDashboard },
        { to: "/admin/analytics", label: "Reports", icon: BarChart3 },
      ],
    },
    {
      label: "Clients and requests",
      items: [
        { to: "/admin/clients", label: TA_COPY.navigation.clients, icon: Building2 },
        { to: "/admin/mrfs", label: TA_COPY.navigation.manpowerRequests, icon: ClipboardList },
        { to: "/admin/jobs", label: TA_COPY.navigation.openings, icon: Briefcase },
      ],
    },
    {
      label: "People & access",
      items: [
        {
          to: "/admin/users",
          label: "Users",
          icon: Users2,
          badge: {
            count: expiredInvitations,
            label: `${expiredInvitations} expired ${expiredInvitations === 1 ? "invitation" : "invitations"}`,
          },
        },
      ],
    },
    {
      label: "Candidate matching",
      items: [
        { to: "/admin/scoring", label: "Matching settings", icon: Sliders },
        {
          to: "/admin/scoring/quality",
          label: "Match results",
          icon: Activity,
          badge: {
            count: failedJobs,
            label: `${failedJobs} failed scoring ${failedJobs === 1 ? "job" : "jobs"}`,
          },
        },
      ],
    },
    {
      label: "Records & recovery",
      items: [
        { to: "/admin/audit", label: "Activity history", icon: History },
        { to: "/admin/maintenance", label: "Backups and recovery", icon: Database },
      ],
    },
  ];

  const isNavItemActive = (to: string) => isAdminNavItemActive(location.pathname, to);

  const currentSectionLabel =
    adminNavSections.flatMap((section) => section.items).find((item) => isNavItemActive(item.to))?.label ??
    (location.pathname.startsWith("/admin/notifications")
      ? "Notifications"
      : location.pathname.startsWith("/admin/settings")
        ? "Settings"
        : "Administration");

  const actualName = resolveUserName(user ? { ...user, email: null } : user, "");
  const hasActualName = Boolean(actualName);
  const fullName = actualName || user?.email || "Administrator";
  const [firstName, ...lastNames] = actualName.split(/\s+/);
  const initials = hasActualName ? getInitials(firstName, lastNames.join(" ")) : "AD";

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage restrictions.
      }
      return next;
    });
  };

  const closeAccountMenu = () => {
    setAccountMenuOpen(false);
    accountButtonRef.current?.focus();
  };

  // Close account menu on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    if (accountMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [accountMenuOpen]);

  // Keep the mobile navigation usable with a keyboard and return focus to its opener.
  const mobileMenuWasOpen = useRef(false);
  useEffect(() => {
    if (!mobileMenuOpen) {
      // Only after a close; focusing on first load would put a stray ring on the menu button.
      if (mobileMenuWasOpen.current) mobileMenuButtonRef.current?.focus();
      mobileMenuWasOpen.current = false;
      return;
    }
    mobileMenuWasOpen.current = true;
    document.body.style.overflow = "hidden";

    const drawer = mobileMenuRef.current;
    const getFocusable = () =>
      Array.from(
        drawer?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );

    const first = getFocusable()[0];
    requestAnimationFrame(() => first?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  // Keyboard navigation for account menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!accountMenuOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        closeAccountMenu();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const items = menuItemsRef.current.filter(Boolean) as (HTMLAnchorElement | HTMLButtonElement)[];
        if (items.length === 0) return;
        const activeIdx = items.findIndex((el) => el === document.activeElement);
        const nextIdx = activeIdx < items.length - 1 ? activeIdx + 1 : 0;
        items[nextIdx]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const items = menuItemsRef.current.filter(Boolean) as (HTMLAnchorElement | HTMLButtonElement)[];
        if (items.length === 0) return;
        const activeIdx = items.findIndex((el) => el === document.activeElement);
        const prevIdx = activeIdx > 0 ? activeIdx - 1 : items.length - 1;
        items[prevIdx]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        const items = menuItemsRef.current.filter(Boolean) as (HTMLAnchorElement | HTMLButtonElement)[];
        items[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        const items = menuItemsRef.current.filter(Boolean) as (HTMLAnchorElement | HTMLButtonElement)[];
        items[items.length - 1]?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  // Ctrl/Cmd+K jumps to the global search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k") return;
      const input = document.querySelector<HTMLInputElement>('header input[role="combobox"]');
      if (!input || input.offsetParent === null) return;
      e.preventDefault();
      input.focus();
      input.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Past the idle limit: show no data while the sign-out request completes.
  if (idle.expired) return null;

  return (
    <div
      className="admin-portal min-h-screen bg-ta-page flex flex-col lg:flex-row overflow-x-clip"
      style={{ "--portal-sidebar-w": collapsed ? "4rem" : "16rem" } as React.CSSProperties}
    >
      <title>MEGS Admin</title>
      <meta name="robots" content="noindex" />
      <a href="#admin-main-content" className="admin-skip-link">Skip to content</a>
      <RealtimeToastContainer toasts={activeToasts} onDismiss={dismissToast} onToastClick={handleToastClick} />

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside
            id="admin-mobile-navigation"
            ref={mobileMenuRef}
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="relative flex-1 flex flex-col max-w-xs w-full border-t-4 border-t-megs-red bg-megs-navy-900 text-white/75 border-r border-white/10 shadow-2xl z-10 animate-in slide-in-from-left duration-200"
          >
            {/* Drawer Header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-white/10">
              <BrandLockup />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="focus-ring-dark min-h-11 min-w-11 inline-flex items-center justify-center rounded-md text-white/75 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Navigation List */}
            <AdminNavList
              sections={adminNavSections}
              isActive={isNavItemActive}
              size="lg"
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Admin Desktop Persistent Sidebar */}
      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 z-40 border-t-4 border-t-megs-red bg-megs-navy-900 text-white/75 flex-col border-r border-white/10 transition-all duration-150 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Brand Header */}
        <div className={`flex shrink-0 items-center border-b border-white/10 ${collapsed ? "flex-col justify-center gap-1.5 py-2" : "h-14 justify-between px-4"}`}>
          <BrandLockup compact={collapsed} />

          <button
            type="button"
            onClick={toggleCollapsed}
            className="focus-ring-dark min-h-9 min-w-9 inline-flex items-center justify-center rounded-md text-white/75 hover:text-white hover:bg-white/5 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <AdminNavList
          sections={adminNavSections}
          isActive={isNavItemActive}
          size="md"
          collapsed={collapsed}
        />
      </aside>

      {/* Sign Out Warning Dialog */}
      <SignOutDialog
        open={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
      />

      <IdleWarningDialog open={idle.warning} secondsLeft={idle.secondsLeft ?? 0} onStay={idle.stay} />

      {/* Main Workspace Layout */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-150 ${collapsed ? "lg:pl-16" : "lg:pl-64"}`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-300 flex items-center justify-between px-3 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              ref={mobileMenuButtonRef}
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden min-h-11 min-w-11 inline-flex items-center justify-center text-slate-600 hover:text-slate-900 border border-slate-300 hover:bg-slate-50 transition-colors rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="admin-mobile-navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <h2 className="lg:hidden text-sm font-semibold text-slate-900 truncate">{currentSectionLabel}</h2>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2 md:justify-start min-w-0 px-2 md:px-4">
            <div className="group flex w-full min-w-0 items-center gap-2 md:max-w-[480px]">
              <AdminGlobalSearch />
              <kbd
                aria-hidden="true"
                className="hidden shrink-0 select-none rounded border border-slate-300 bg-slate-50 font-sans px-1.5 py-0.5 text-[11px] font-medium text-slate-600 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 xl:inline-block"
              >
                {SEARCH_HINT}
              </kbd>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <NotificationBell
              notifications={notifications}
              loading={notificationsLoading}
              open={bellOpen}
              onOpenChange={setBellOpen}
              unreadCount={unreadCount}
              onMarkAsRead={markAsRead}
              viewAllLink="/admin/notifications"
            />

            {/* Top-Right Account Menu Dropdown */}
            <div className="relative inline-block text-left pl-2 sm:pl-3 border-l border-slate-300" ref={accountMenuRef}>
              <button
                ref={accountButtonRef}
                id="admin-account-button"
                type="button"
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                className="group min-h-11 flex items-center gap-2 sm:gap-2.5 p-1 sm:px-2 sm:py-1 rounded-md text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 cursor-pointer"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-controls="admin-account-menu"
              >
                <div aria-hidden="true" className="w-8 h-8 bg-navy text-white rounded-md text-xs font-semibold flex items-center justify-center shrink-0">
                  {initials}
                </div>
                <span className="sr-only sm:hidden">{fullName}</span>
                <div className="hidden sm:block text-left leading-tight">
                  <div className="text-xs font-bold text-slate-900 truncate max-w-[140px]">
                    {fullName}
                  </div>
                  <div className="text-xs text-slate-600 font-medium truncate max-w-[140px]">
                    Administrator
                  </div>
                </div>
                <span className="sr-only">, account menu</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-600 group-hover:text-slate-900 transition-transform duration-150 shrink-0 ${
                    accountMenuOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>

              {accountMenuOpen && (
                <div
                  id="admin-account-menu"
                  role="menu"
                  aria-labelledby="admin-account-button"
                  onKeyDown={(e) => {
                    if (e.key === "Tab") closeAccountMenu();
                  }}
                  className="absolute right-0 mt-1.5 w-64 rounded-md bg-white shadow-modal border border-slate-300 z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100"
                >
                  {/* User Identity Context Card */}
                  <div className="p-3 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 bg-navy text-white rounded-md text-xs font-semibold flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="overflow-hidden min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{fullName}</div>
                        {hasActualName && user?.email && (
                          <div className="text-[11px] text-slate-600 truncate">{user.email}</div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-navy-soft text-navy border border-navy-line text-xs font-medium">
                        Administrator
                      </span>
                    </div>
                  </div>

                  {/* Navigation & Action Items */}
                  <div className="py-1">
                    <Link
                      to="/admin/settings"
                      role="menuitem"
                      tabIndex={0}
                      ref={(el) => { menuItemsRef.current[0] = el; }}
                      onClick={closeAccountMenu}
                      className="min-h-11 flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors focus-visible:outline-none focus-visible:bg-slate-100 focus-visible:text-slate-950 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                    >
                      <Settings className="w-4 h-4 text-slate-600 shrink-0" aria-hidden="true" />
                      <span className="text-slate-900 font-medium">Settings</span>
                    </Link>
                  </div>

                  {/* Sign Out Action */}
                  <div className="border-t border-slate-200 py-1">
                    <button
                      type="button"
                      role="menuitem"
                      tabIndex={0}
                      ref={(el) => { menuItemsRef.current[1] = el; }}
                      onClick={() => {
                        closeAccountMenu();
                        setShowSignOutConfirm(true);
                      }}
                      className="min-h-11 w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 hover:text-rose-900 transition-colors focus-visible:outline-none focus-visible:bg-rose-50 focus-visible:text-rose-900 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
                      <span className="text-rose-900 font-medium">Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Container */}
        <main id="admin-main-content" tabIndex={-1} className="flex-1 p-3 sm:p-5 lg:p-6 max-w-[1600px] w-full mx-auto min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
