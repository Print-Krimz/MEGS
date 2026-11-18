import React, { useState, useRef, useEffect } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  FileText,
  FolderOpen,
  User,
  Settings,
  LogOut,
  Layers,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { NotificationBell, RealtimeToastContainer, SignOutDialog } from "../components/common";
import { getInitials } from "../lib/utils";
import { applicantApi } from "../lib/api/applicant.api";

import { normalizeTitleCase } from "../lib/text-case";

export const ApplicantLayout: React.FC = () => {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const menuItemsRef = useRef<(HTMLAnchorElement | HTMLButtonElement | null)[]>([]);

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

  const profileQuery = useQuery({
    queryKey: ["applicant", "profile"],
    queryFn: applicantApi.getProfile,
    enabled: Boolean(user),
    staleTime: 1000 * 30,
  });

  const profile = profileQuery.data || user?.applicantProfile;
  const rawFirst = profile?.firstName || "";
  const rawLast = profile?.lastName || "";
  const cleanFirst = normalizeTitleCase(rawFirst) || rawFirst;
  const cleanLast = normalizeTitleCase(rawLast) || rawLast;
  const fullName = profile
    ? `${cleanFirst} ${cleanLast}`.trim() || user?.email || "Applicant"
    : user?.email || "Applicant";
  const initials = getInitials(cleanFirst, cleanLast);

  // Primary Recruitment Navigation Links
  const navLinks = [
    { to: "/app", label: "Dashboard", icon: Layers },
    { to: "/app/jobs", label: "Browse Jobs", icon: Briefcase },
    { to: "/app/applications", label: "My Applications", icon: FileText },
    { to: "/app/documents", label: "My Documents", icon: FolderOpen },
    { to: "/app/profile", label: "My Profile", icon: User },
  ];

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

  // Escape closes the mobile drawer and hands focus back to its toggle
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMobileMenuOpen(false);
      menuToggleRef.current?.focus();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [mobileMenuOpen]);

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

  return (
    <div className="applicant-portal min-h-screen bg-ta-page text-slate-900 flex flex-col font-sans selection:bg-[#0B315D] selection:text-white">
      <title>MEGS Applicant Portal</title>
      <meta name="robots" content="noindex" />
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-md focus:border focus:border-[#0B315D] focus:bg-white focus:px-4 focus:text-sm focus:font-semibold focus:text-[#0B315D] focus:outline-none focus:ring-2 focus:ring-[#0B315D] focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <RealtimeToastContainer toasts={activeToasts} onDismiss={dismissToast} onToastClick={handleToastClick} />

      {/* Top Navigation Header */}
      <header className="top-0 z-30 bg-white [@media(min-height:500px)]:sticky border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Mobile Menu Button */}
            <div className="flex items-center gap-3 sm:gap-6 min-w-0">
              <button
                ref={menuToggleRef}
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="xl:hidden min-h-11 min-w-11 inline-flex items-center justify-center text-slate-600 hover:text-[#0B315D] border border-slate-200 hover:bg-[#EAF0F7] transition-colors shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D]"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
                aria-controls="applicant-mobile-menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <Link
                to="/app"
                className="flex items-center gap-2.5 min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] rounded-md py-1 pr-2 group shrink-0"
                aria-label="MEGS Candidate Portal Home"
              >
                <span className="font-display text-xl tracking-tight leading-none text-megs-red">
                  MEGS
                </span>
                <span aria-hidden="true" className="h-4 w-px bg-slate-300" />
                <span className="text-xs font-semibold leading-none text-slate-600">
                  Candidate Portal
                </span>
              </Link>

              {/* Primary Desktop Navigation Links */}
              <nav className="hidden xl:flex items-center gap-1 ml-4" aria-label="Main Applicant Navigation">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      activeOptions={{ exact: item.to === "/app" }}
                      activeProps={{
                        className:
                          "bg-[#EAF0F7] text-[#0B315D] font-semibold ring-1 ring-inset ring-[#0B315D]/15",
                      }}
                      inactiveProps={{
                        className:
                          "text-slate-600 font-medium hover:text-[#0B315D] hover:bg-slate-100/80",
                      }}
                      className="inline-flex h-9 items-center gap-2 whitespace-nowrap px-3 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-1"
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right Tools & Applicant Account Menu */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <NotificationBell
                notifications={notifications}
                loading={notificationsLoading}
                open={bellOpen}
                onOpenChange={setBellOpen}
                unreadCount={unreadCount}
                onMarkAsRead={markAsRead}
                viewAllLink="/app/notifications"
              />

              {/* Top-Right Account Menu Dropdown */}
              <div className="relative inline-block text-left pl-2 sm:pl-3 border-l border-slate-200" ref={accountMenuRef}>
                <button
                  ref={accountButtonRef}
                  id="applicant-account-button"
                  type="button"
                  onClick={() => setAccountMenuOpen((prev) => !prev)}
                  className="group min-h-11 min-w-11 flex items-center gap-2 sm:gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[#102A43] hover:bg-[#EAF0F7]/70 hover:text-[#0B315D] border border-transparent hover:border-[#D9E2EC] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-1 cursor-pointer"
                  aria-label={`Account menu for ${fullName}`}
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                  aria-controls="applicant-account-menu"
                >
                  <div className="w-8 h-8 bg-[#0B315D] text-white rounded-full text-xs font-bold flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <div className="hidden lg:block text-left leading-tight">
                    <div className="text-xs font-bold text-[#102A43] truncate max-w-[140px]">
                      {fullName}
                    </div>
                    <div className="text-xs text-slate-600 font-medium">Candidate</div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-600 group-hover:text-[#0B315D] transition-transform duration-150 shrink-0 ${
                      accountMenuOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {accountMenuOpen && (
                  <div
                    id="applicant-account-menu"
                    role="menu"
                    aria-labelledby="applicant-account-button"
                    className="absolute right-0 mt-2 w-64 bg-white shadow-lg rounded-xl border border-slate-200 z-50 overflow-hidden"
                  >
                    {/* User Identity Context Card */}
                    <div className="p-3.5 bg-[#F7F9FC] border-b border-slate-200">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-[#0B315D] text-white rounded-full text-xs font-bold flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                        <div className="overflow-hidden min-w-0">
                          <div className="text-xs font-bold text-[#102A43] truncate">
                            {fullName}
                          </div>
                          <div className="text-xs text-slate-600 truncate">
                            {user?.email}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Navigation Items */}
                    <div className="p-1">
                      <Link
                        to="/app/profile"
                        role="menuitem"
                        tabIndex={0}
                        ref={(el) => { menuItemsRef.current[0] = el; }}
                        onClick={() => setAccountMenuOpen(false)}
                        className="min-h-11 flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#102A43] hover:bg-[#EAF0F7] hover:text-[#0B315D] rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D]"
                      >
                        <User className="w-4 h-4 text-slate-600 shrink-0" aria-hidden="true" />
                        <div className="flex flex-col text-left">
                          <span className="font-semibold text-[#102A43]">Profile &amp; Resume</span>
                          <span className="text-xs text-slate-600 font-normal">Qualifications &amp; clearances</span>
                        </div>
                      </Link>

                      <Link
                        to="/app/settings"
                        role="menuitem"
                        tabIndex={0}
                        ref={(el) => { menuItemsRef.current[1] = el; }}
                        onClick={() => {
                          accountButtonRef.current?.focus();
                          setAccountMenuOpen(false);
                        }}
                        className="min-h-11 flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#102A43] hover:bg-[#EAF0F7] hover:text-[#0B315D] rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D]"
                      >
                        <Settings className="w-4 h-4 text-slate-600 shrink-0" aria-hidden="true" />
                        <div className="flex flex-col text-left">
                          <span className="font-semibold text-[#102A43]">Settings</span>
                          <span className="text-xs text-slate-600 font-normal">Account and security</span>
                        </div>
                      </Link>
                    </div>

                    {/* Sign Out Action */}
                    <div className="border-t border-slate-200 p-1">
                      <button
                        type="button"
                        role="menuitem"
                        tabIndex={0}
                        ref={(el) => { menuItemsRef.current[2] = el; }}
                        onClick={() => {
                          accountButtonRef.current?.focus();
                          setAccountMenuOpen(false);
                          setShowSignOutConfirm(true);
                        }}
                        className="min-h-11 w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 hover:text-rose-900 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
                        <div className="flex flex-col text-left">
                          <span className="font-semibold text-rose-900">Sign Out</span>
                          <span className="text-xs text-rose-700/80 font-normal">End your current session</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div id="applicant-mobile-menu" className="xl:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 shadow-md animate-in slide-in-from-top-2 duration-150">
            {navLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  activeOptions={{ exact: item.to === "/app" }}
                  activeProps={{ className: "bg-[#0B315D] text-white hover:bg-[#082747] hover:text-white font-bold" }}
                  inactiveProps={{ className: "font-medium text-[#102A43] hover:bg-[#EAF0F7] hover:text-[#0B315D]" }}
                  className="flex min-h-11 items-center gap-3 px-3.5 py-2.5 text-sm rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D]"
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 focus:outline-none max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 min-w-0">
        <Outlet />
      </main>

      {/* Sign Out Warning Dialog */}
      <SignOutDialog
        open={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-5 px-4 text-center sm:text-left text-xs text-slate-600">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} MAR Employment for Good Services Inc. All rights reserved.</span>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <span className="text-xs text-slate-600">DOLE Licensed Private Employment Agency • Valenzuela City</span>
            <Link
              to="/"
              className="inline-flex min-h-11 items-center px-1.5 font-semibold text-[#0B315D] hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D]"
            >
              Company Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
