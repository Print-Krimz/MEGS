import React, { lazy, Suspense, useState, useRef, useEffect } from "react";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  ClipboardList,
  Calendar,
  Building2,
  Send,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  ChevronDown,
  Shield,
  // UserSearch,
  FileCheck2,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { NotificationBell, RealtimeToastContainer, SignOutDialog } from "../components/common";
import { getInitials } from "../lib/utils";
import { Role } from "../lib/types/enums";
import { TA_COPY } from "../lib/ta-copy";
import { taApi } from "../lib/api/ta.api";
import { REFERENCE_QUERY_STALE_TIME_MS } from "../lib/query-policies";
import { employeesApi } from "../lib/api/employees.api";
import { TAGlobalSearch } from "./TAGlobalSearch";

const ChangePasswordModal = lazy(() =>
  import("../components/common/ChangePasswordModal").then((m) => ({ default: m.ChangePasswordModal })),
);

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Small count pill. Hidden when 0. `label` is read out by screen readers. */
  badge?: { count: number; label: string; /** "action" (default) = needs TA work, red pill. "info" = grey. */ tone?: "action" | "info" };
}
interface NavSection {
  label: string;
  items: NavItem[];
}

const SEARCH_HINT =
  typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform ?? "") ? "\u2318 K" : "Ctrl K";

/** The portal name. The collapsed rail shows nothing here, only its expand button. */
const BrandLockup: React.FC<{ compact?: boolean }> = ({ compact = false }) =>
  compact ? null : (
    <div className="flex min-w-0 items-center">
      <span className="truncate text-sm font-semibold leading-tight text-white">Talent Acquisition</span>
    </div>
  );

/** One nav list for the mobile drawer (size "lg", 44px rows) and the desktop sidebar (size "md"). */
const NavList: React.FC<{
  sections: NavSection[];
  isActive: (to: string) => boolean;
  size: "md" | "lg";
  collapsed?: boolean;
  onNavigate?: () => void;
}> = ({ sections, isActive, size, collapsed = false, onNavigate }) => (
  <nav
    aria-label="TA portal"
    className={`flex-1 overflow-y-auto py-3 space-y-5 ${size === "lg" ? "px-3" : "px-2"}`}
  >
    {sections.map((section) => (
      <div key={section.label} className="space-y-1">
        {!collapsed && <div className="px-3 text-[11px] font-medium uppercase tracking-wide text-white/55">{section.label}</div>}
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
                      className={`rounded-full px-1.5 text-xs font-semibold leading-5 tabular-nums ${item.badge?.tone === "info" ? "bg-white/15 text-white" : "bg-white text-megs-red"} ${
                        collapsed ? "absolute right-0.5 top-0.5 min-w-5 text-center text-[10px] leading-4" : "ml-auto"
                      }`}
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

export const TALayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const isNavItemActive = (itemTo: string) => {
    const pathname = location.pathname;
    if (itemTo === "/ta") return pathname === "/ta";
    if (itemTo === "/ta/workforce") {
      return (
        pathname.startsWith("/ta/workforce") ||
        pathname.startsWith("/ta/deployments") ||
        pathname.startsWith("/ta/employees")
      );
    }
    // /ta/compliance is the old address of the requirements queue.
    if (itemTo === "/ta/requirements") {
      return pathname.startsWith("/ta/requirements") || pathname.startsWith("/ta/compliance");
    }
    return pathname.startsWith(itemTo);
  };
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const menuItemsRef = useRef<(HTMLAnchorElement | HTMLButtonElement | null)[]>([]);
  const mobileMenuRef = useRef<HTMLElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

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

  const profile = user?.applicantProfile;
  const hasProfileName = Boolean(profile?.firstName && profile?.lastName);
  const fullName = hasProfileName ? `${profile!.firstName} ${profile!.lastName}` : user?.email || "Recruiter";
  const initials = getInitials(profile?.firstName, profile?.lastName) || "TA";

  // Every close path returns focus to the trigger so keyboard users never land on <body>.
  const closeAccountMenu = () => {
    setAccountMenuOpen(false);
    accountButtonRef.current?.focus();
  };

  // Close account menu on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        closeAccountMenu();
      }
    };
    if (accountMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [accountMenuOpen]);

  // Treat the mobile navigation as a modal drawer: keep focus inside it,
  // close on Escape, and return focus to the trigger when it closes.
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const menuTrigger = mobileMenuButtonRef.current;
    const getFocusableElements = () =>
      Array.from(
        mobileMenuRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
        ) ?? []
      );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusableElements();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => getFocusableElements()[0]?.focus());

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
      requestAnimationFrame(() => previousFocus?.focus() || menuTrigger?.focus());
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
        const currentIndex = items.findIndex((item) => item === document.activeElement);
        const nextIndex = currentIndex === -1 || currentIndex === items.length - 1 ? 0 : currentIndex + 1;
        items[nextIndex]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const items = menuItemsRef.current.filter(Boolean) as (HTMLAnchorElement | HTMLButtonElement)[];
        if (items.length === 0) return;
        const currentIndex = items.findIndex((item) => item === document.activeElement);
        const prevIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
        items[prevIndex]?.focus();
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
    return () => window.removeEventListener("keydown", handleKeyDown);
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

  const overdueInterviews = useQuery({
    // Same key and fetcher as the dashboard interview SLA card, so the cache is shared.
    queryKey: ["ta", "compliance", "interviews", "summary"],
    queryFn: ({ signal }) => taApi.listInterviewCompliancePage({ page: 1, pageSize: 1 }, { signal }),
    staleTime: 60_000, // an SLA breach is time-driven; no event refreshes it
  }).data?.summary?.breached ?? 0;
  const documentsToReview = useQuery({
    // Same key and fetcher the requirements queue used for its totals, so the cache is shared.
    queryKey: ["ta", "analytics", "compliance", "COMPLIANCE"],
    queryFn: () => taApi.getComplianceOverview({ stage: "COMPLIANCE" }),
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
  }).data?.statusBreakdown?.SUBMITTED ?? 0;
  const needsPlacement = useQuery({
    // Same key and fetcher as the Workforce page summary.
    queryKey: ["ta", "redeployment-queue", "summary"],
    queryFn: ({ signal }) => employeesApi.getRedeploymentQueueSummary({ signal }),
    staleTime: 60_000,
  }).data?.stages?.NEEDS_PLACEMENT ?? 0;

  const navSections: NavSection[] = [
    {
      label: "Recruitment",
      items: [
        { to: "/ta", label: TA_COPY.navigation.overview, icon: LayoutDashboard },
        { to: "/ta/applications", label: TA_COPY.navigation.applications, icon: Users },
        {
          to: "/ta/requirements",
          label: TA_COPY.navigation.requirements,
          icon: FileCheck2,
          badge: { count: documentsToReview, label: `${documentsToReview} ${documentsToReview === 1 ? "document" : "documents"} awaiting review` },
        },
        { to: "/ta/jobs", label: TA_COPY.navigation.openings, icon: Briefcase },
        { to: "/ta/mrfs", label: TA_COPY.navigation.manpowerRequests, icon: ClipboardList },
      ],
    },
    {
      label: "Candidates & clients",
      items: [
        // Candidate pool hidden for now. Restore with the UserSearch import and the route in routes.tsx.
        // { to: "/ta/talent-pool", label: TA_COPY.navigation.candidatePool, icon: UserSearch },
        {
          to: "/ta/interviews",
          label: TA_COPY.navigation.interviews,
          icon: Calendar,
          badge: { count: overdueInterviews, label: `${overdueInterviews} overdue ${overdueInterviews === 1 ? "interview" : "interviews"}` },
        },
        { to: "/ta/clients", label: TA_COPY.navigation.clients, icon: Building2 },
      ],
    },
    {
      label: "Workforce",
      items: [
        {
          to: "/ta/workforce",
          label: TA_COPY.navigation.workforce,
          icon: Send,
          badge: { count: needsPlacement, label: `${needsPlacement} ${needsPlacement === 1 ? "worker needs" : "workers need"} placement` },
        },
      ],
    },
    {
      label: "Reports",
      items: [
        { to: "/ta/analytics", label: TA_COPY.navigation.reports, icon: BarChart3 },
      ],
    },
  ];

  const currentSectionLabel =
    navSections.flatMap((section) => section.items).find((item) => isNavItemActive(item.to))?.label ??
    (location.pathname.startsWith("/ta/notifications") ? "Notifications" : "Talent Acquisition");

  return (
    <div className="ta-portal min-h-screen bg-ta-page flex flex-col lg:flex-row overflow-x-hidden">
      <title>MEGS Talent Acquisition</title>
      <meta name="robots" content="noindex" />
      <RealtimeToastContainer toasts={activeToasts} onDismiss={dismissToast} onToastClick={handleToastClick} />

      <a
        href="#ta-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-modal focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        Skip to main content
      </a>

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside
            ref={mobileMenuRef}
            id="ta-mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="TA portal navigation"
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
            <NavList sections={navSections} isActive={isNavItemActive} size="lg" onNavigate={() => setMobileMenuOpen(false)} />
          </aside>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
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
            onClick={() => setCollapsed(!collapsed)}
            className="focus-ring-dark min-h-9 min-w-9 inline-flex items-center justify-center rounded-md text-white/75 hover:text-white hover:bg-white/5 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <NavList sections={navSections} isActive={isNavItemActive} size="md" collapsed={collapsed} />
      </aside>

      {/* Sign Out Warning Dialog */}
      <SignOutDialog
        open={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
      />

      {/* Main Workspace Layout */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-150 ${collapsed ? "lg:pl-16" : "lg:pl-64"}`}>
        {/* Top Operational Bar */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-300 flex items-center justify-between px-3 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              ref={mobileMenuButtonRef}
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden min-h-11 min-w-11 inline-flex items-center justify-center text-slate-600 hover:text-slate-900 border border-slate-300 hover:bg-slate-50 transition-colors rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="ta-mobile-navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <h2 className="lg:hidden text-sm font-semibold text-slate-900 truncate">{currentSectionLabel}</h2>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2 md:justify-start min-w-0 px-2 md:px-4">
            <div className="group flex w-full min-w-0 items-center gap-2 md:max-w-[480px]">
              <TAGlobalSearch />
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
              viewAllLink="/ta/notifications"
            />

            {/* Top-Right Account Menu Dropdown */}
            <div className="relative inline-block text-left pl-2 sm:pl-3 border-l border-slate-300" ref={accountMenuRef}>
              <button
                ref={accountButtonRef}
                id="ta-account-button"
                type="button"
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                className="group min-h-11 flex items-center gap-2 sm:gap-2.5 p-1 sm:px-2 sm:py-1 rounded-md text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 cursor-pointer"
                aria-label={`Account menu for ${fullName}`}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-controls="ta-account-menu"
              >
                <div className="w-8 h-8 rounded-md bg-navy text-white text-xs font-semibold flex items-center justify-center shrink-0">
                  {initials}
                </div>
                <div className="hidden sm:block text-left leading-tight">
                  <div className="text-xs font-bold text-slate-900 truncate max-w-[140px]">
                    {fullName}
                  </div>
                  <div className="text-xs text-slate-500 truncate max-w-[140px]">
                    {user?.role === Role.ADMINISTRATOR ? "Administrator" : "Talent Acquisition"}
                  </div>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform duration-150 shrink-0 ${
                    accountMenuOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>

              {accountMenuOpen && (
                <div
                  id="ta-account-menu"
                  role="menu"
                  aria-labelledby="ta-account-button"
                  onKeyDown={(e) => {
                    if (e.key === "Tab") closeAccountMenu();
                  }}
                  className="absolute right-0 mt-1.5 w-64 rounded-md bg-white shadow-modal border border-slate-300 z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100"
                >
                  {/* User Identity Context Card */}
                  <div className="p-3 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-md bg-navy text-white text-xs font-semibold flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="overflow-hidden min-w-0">
                        {hasProfileName ? (
                          <>
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {fullName}
                            </div>
                            <div className="text-[11px] text-slate-600 truncate">
                              {user?.email}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {user?.email}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-navy-soft text-navy border border-navy-line text-xs font-medium">
                        {user?.role === Role.ADMINISTRATOR ? "Admin & TA Portal" : "Talent Acquisition"}
                      </span>
                    </div>
                  </div>

                  {/* Navigation & Action Items */}
                  <div className="py-1">
                    <button
                      type="button"
                      role="menuitem"
                      tabIndex={0}
                      ref={(el) => { menuItemsRef.current[0] = el; }}
                      onClick={() => {
                        closeAccountMenu();
                        setShowChangePasswordModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors focus-visible:outline-none focus-visible:bg-slate-100 focus-visible:text-slate-950 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus text-left cursor-pointer"
                    >
                      <Shield className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="text-slate-900 font-medium">Change password</span>
                    </button>
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
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 hover:text-rose-900 transition-colors focus-visible:outline-none focus-visible:bg-rose-50 focus-visible:text-rose-900 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus text-left cursor-pointer"
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

        {/* Account Security / Change Password Dialog */}
        {showChangePasswordModal && (
          <Suspense fallback={null}>
            <ChangePasswordModal open onClose={() => setShowChangePasswordModal(false)} />
          </Suspense>
        )}

        {/* Content Container */}
        <main id="ta-main-content" className="flex-1 p-3 sm:p-5 lg:p-6 max-w-[1600px] w-full mx-auto min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
