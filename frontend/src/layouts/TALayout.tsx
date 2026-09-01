import React, { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { NotificationBell, RealtimeToastContainer, SignOutDialog, ChangePasswordModal } from "../components/common";
import { getInitials } from "../lib/utils";
import { Role } from "../lib/types/enums";

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
        pathname.startsWith("/ta/employees") ||
        pathname.startsWith("/ta/compliance")
      );
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

  const {
    unreadCount,
    notifications,
    markAsRead,
    activeToasts,
    dismissToast,
  } = useRealtimeNotifications();

  const profile = user?.applicantProfile;
  const hasProfileName = Boolean(profile?.firstName && profile?.lastName);
  const fullName = hasProfileName ? `${profile!.firstName} ${profile!.lastName}` : user?.email || "Recruiter";
  const initials = getInitials(profile?.firstName, profile?.lastName) || "TA";

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

  // Keyboard navigation for account menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!accountMenuOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setAccountMenuOpen(false);
        accountButtonRef.current?.focus();
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

  const navSections = [
    {
      label: "Recruitment",
      items: [
        { to: "/ta", label: "Overview", icon: LayoutDashboard },
        { to: "/ta/applications", label: "Applications", icon: Users },
        { to: "/ta/jobs", label: "Jobs", icon: Briefcase },
        { to: "/ta/mrfs", label: "Hiring requests (MRF)", icon: ClipboardList },
      ],
    },
    {
      label: "Candidates and interviews",
      items: [
        { to: "/ta/talent-pool", label: "Candidate pool", icon: Users },
        { to: "/ta/interviews", label: "Interviews", icon: Calendar },
        { to: "/ta/clients", label: "Clients and submissions", icon: Building2 },
      ],
    },
    {
      label: "Workforce & placement",
      items: [
        { to: "/ta/workforce", label: "Workforce & placements", icon: Send },
      ],
    },
    {
      label: "Reports",
      items: [
        { to: "/ta/analytics", label: "Reports", icon: BarChart3 },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row overflow-x-hidden">
      <RealtimeToastContainer toasts={activeToasts} onDismiss={dismissToast} />

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-950 text-slate-300 border-r border-slate-800 shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="h-14 flex items-center justify-between px-4 bg-slate-950 border-b border-slate-800">
              <div className="leading-tight">
                <div className="text-base font-bold font-mono tracking-tight text-white">MEGS</div>
                <div className="text-xs text-slate-400">Talent acquisition</div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Navigation List */}
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
              {navSections.map((section, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="px-2 text-xs font-medium text-slate-400">
                    {section.label}
                  </div>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = isNavItemActive(item.to);
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex min-h-11 items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                            isActive
                              ? "bg-teal-700 text-white font-medium border-l-2 border-teal-400"
                              : "text-slate-200 hover:text-white hover:bg-slate-850"
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 z-40 bg-slate-950 text-slate-300 flex-col border-r border-slate-800 transition-all duration-150 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-4 bg-slate-950 border-b border-slate-800">
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-base font-bold font-mono tracking-tight text-white">MEGS</div>
              <div className="text-xs text-slate-400">Talent acquisition</div>
            </div>
          )}

          {collapsed && (
            <div className="w-full flex justify-center">
              <span className="font-mono font-bold text-sm text-teal-400">M</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
          {navSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {!collapsed && (
                <div className="px-2 text-xs font-medium text-slate-400">
                  {section.label}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = isNavItemActive(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex min-h-9 items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? "bg-teal-700 text-white font-medium border-l-2 border-teal-400"
                          : "text-slate-200 hover:text-white hover:bg-slate-850"
                      }`}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
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
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 border border-slate-300 hover:bg-slate-50 transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="h-2 w-2 bg-teal-600 shrink-0" />
            <span className="text-sm font-medium text-slate-700 truncate">
              <span>MEGS Recruitment</span>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <NotificationBell
              notifications={notifications}
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
                className="group min-h-11 flex items-center gap-2 sm:gap-2.5 p-1 sm:px-2 sm:py-1 rounded-md text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1 cursor-pointer"
                aria-label={`Account menu for ${fullName}`}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-controls="ta-account-menu"
              >
                <div className="w-7 h-7 bg-slate-800 text-teal-400 border border-slate-700 text-xs font-mono font-bold flex items-center justify-center shrink-0">
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
                  className="absolute right-0 mt-1.5 w-64 bg-white shadow-modal border border-slate-300 z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100"
                >
                  {/* User Identity Context Card */}
                  <div className="p-3 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-slate-800 text-teal-400 border border-slate-700 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="overflow-hidden min-w-0">
                        {hasProfileName ? (
                          <>
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {fullName}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono truncate">
                              {user?.email}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs font-semibold text-slate-900 font-mono truncate">
                            {user?.email}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-mono font-medium">
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
                        setAccountMenuOpen(false);
                        setShowChangePasswordModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors focus-visible:outline-none focus-visible:bg-slate-100 focus-visible:text-slate-950 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700 text-left cursor-pointer"
                    >
                      <Shield className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="text-slate-900 font-medium">Account Security</span>
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
                        setAccountMenuOpen(false);
                        setShowSignOutConfirm(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 hover:text-rose-900 transition-colors focus-visible:outline-none focus-visible:bg-rose-50 focus-visible:text-rose-900 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700 text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
                      <span className="text-rose-900 font-medium">Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Account Security / Change Password Dialog */}
        <ChangePasswordModal
          open={showChangePasswordModal}
          onClose={() => setShowChangePasswordModal(false)}
        />

        {/* Content Container */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-[1600px] w-full mx-auto min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
