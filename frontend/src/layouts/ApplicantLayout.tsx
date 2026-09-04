import React, { useState, useRef, useEffect } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  FileText,
  User as UserIcon,
  Shield,
  LogOut,
  Layers,
  Menu,
  X,
  ChevronDown,
  Bookmark,
  Home,
  LogIn,
  UserPlus,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { NotificationBell, RealtimeToastContainer, SignOutDialog, ChangePasswordModal } from "../components/common";
import { getInitials } from "../lib/utils";
import { applicantApi } from "../lib/api/applicant.api";

export const ApplicantLayout: React.FC = () => {
  const { user } = useAuth();
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

  const profileQuery = useQuery({
    queryKey: ["applicant", "profile"],
    queryFn: applicantApi.getProfile,
    enabled: Boolean(user),
    staleTime: 1000 * 30,
  });

  const profile = profileQuery.data || user?.applicantProfile;
  const fullName = profile
    ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || user?.email || "Applicant"
    : user?.email || "Applicant";
  const initials = getInitials(profile?.firstName, profile?.lastName);

  // Primary Recruitment Navigation Links (Profile moved to account menu)
  const navLinks = user
    ? [
        { to: "/app", label: "Dashboard", icon: Layers, exact: true },
        { to: "/app/jobs", label: "Explore Jobs", icon: Briefcase, exact: false },
        { to: "/app/applications", label: "My Applications", icon: FileText, exact: false },
        { to: "/app/jobs?tab=saved", label: "Saved Jobs", icon: Bookmark, exact: false },
      ]
    : [
        { to: "/jobs", label: "Explore Jobs", icon: Briefcase, exact: false },
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
    <div className="min-h-screen bg-slate-50 flex flex-col overflow-x-hidden">
      <RealtimeToastContainer toasts={activeToasts} onDismiss={dismissToast} />

      {/* Top Navigation Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Desktop Nav Links */}
            <div className="flex items-center gap-4 sm:gap-8 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden min-h-11 min-w-11 inline-flex items-center justify-center text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100 transition-colors shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <Link
                to={user ? "/app" : "/"}
                className="flex items-center gap-2.5 text-slate-900 font-bold text-lg shrink-0 group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#0f2b5c] text-white flex items-center justify-center shadow-sm">
                  <Briefcase className="w-4 h-4 text-blue-300" />
                </div>
                <div className="flex flex-col">
                  <span className="tracking-tight font-bold text-slate-900 leading-none">
                    MEGS <span className="text-blue-600 font-normal">Careers</span>
                  </span>
                  <span className="text-[10px] font-normal text-slate-400 leading-none mt-0.5 hidden sm:block">
                    Job Platform
                  </span>
                </div>
              </Link>

              {/* Primary Desktop Navigation Links */}
              <nav className="hidden md:flex items-center gap-1" aria-label="Main Applicant Navigation">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      activeOptions={{ exact: item.exact }}
                      activeProps={{ className: "bg-blue-50 text-blue-700 font-semibold shadow-xs" }}
                      className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right Tools & Identity */}
            <div className="flex items-center gap-3 shrink-0">
              {user ? (
                <>
                  <NotificationBell
                    notifications={notifications}
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
                      className="group min-h-11 flex items-center gap-2 sm:gap-2.5 p-1 sm:px-2.5 sm:py-1 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                      aria-label={`Account menu for ${fullName}`}
                      aria-haspopup="menu"
                      aria-expanded={accountMenuOpen}
                      aria-controls="applicant-account-menu"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#0f2b5c] text-white text-xs font-semibold flex items-center justify-center shrink-0 shadow-xs">
                        {initials}
                      </div>
                      <div className="hidden lg:block text-left leading-tight">
                        <div className="text-xs font-bold text-slate-900 truncate max-w-[140px]">
                          {fullName}
                        </div>
                        <div className="text-[11px] text-slate-500">Applicant</div>
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
                        id="applicant-account-menu"
                        role="menu"
                        aria-labelledby="applicant-account-button"
                        className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden"
                      >
                        {/* User Identity Card */}
                        <div className="p-3.5 bg-slate-50 border-b border-slate-100">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-[#0f2b5c] text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-xs">
                              {initials}
                            </div>
                            <div className="overflow-hidden min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">
                                {fullName}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono truncate">
                                {user?.email}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-medium">
                              Candidate Portal
                            </span>
                          </div>
                        </div>

                        {/* Navigation Items */}
                        <div className="py-1">
                          <Link
                            to="/app/profile"
                            role="menuitem"
                            tabIndex={0}
                            ref={(el) => { menuItemsRef.current[0] = el; }}
                            onClick={() => setAccountMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950 transition-colors focus-visible:outline-none focus-visible:bg-slate-50 focus-visible:text-slate-950 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
                          >
                            <UserIcon className="w-4 h-4 text-slate-400 shrink-0" />
                            <div className="flex flex-col text-left">
                              <span className="font-semibold text-slate-900">Profile</span>
                              <span className="text-[11px] text-slate-500 font-normal">Qualifications & documents</span>
                            </div>
                          </Link>

                          <button
                            type="button"
                            role="menuitem"
                            tabIndex={0}
                            ref={(el) => { menuItemsRef.current[1] = el; }}
                            onClick={() => {
                              setAccountMenuOpen(false);
                              setShowChangePasswordModal(true);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950 transition-colors focus-visible:outline-none focus-visible:bg-slate-50 focus-visible:text-slate-950 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 text-left"
                          >
                            <Shield className="w-4 h-4 text-slate-400 shrink-0" />
                            <div className="flex flex-col text-left">
                              <span className="font-semibold text-slate-900">Account Security</span>
                              <span className="text-[11px] text-slate-500 font-normal">Password & access settings</span>
                            </div>
                          </button>
                        </div>

                        {/* Sign Out Action */}
                        <div className="border-t border-slate-100 py-1">
                          <button
                            type="button"
                            role="menuitem"
                            tabIndex={0}
                            ref={(el) => { menuItemsRef.current[2] = el; }}
                            onClick={() => {
                              setAccountMenuOpen(false);
                              setShowSignOutConfirm(true);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-rose-700 hover:bg-rose-50 hover:text-rose-900 transition-colors focus-visible:outline-none focus-visible:bg-rose-50 focus-visible:text-rose-900 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-600"
                          >
                            <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
                            <div className="flex flex-col text-left">
                              <span className="font-semibold text-rose-900">Sign Out</span>
                              <span className="text-[11px] text-rose-700/70 font-normal">End your current session</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="min-h-10 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="min-h-10 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 shadow-md">
            {navLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  activeOptions={{ exact: item.exact }}
                  activeProps={{ className: "bg-blue-50 text-blue-700 font-semibold" }}
                  className="flex min-h-11 items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-20 md:pb-6 min-w-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-1 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]"
      >
        <div className="flex items-center justify-around">
          {user ? (
            <>
              <Link
                to="/app"
                activeOptions={{ exact: true }}
                activeProps={{ className: "text-blue-600 font-semibold" }}
                className="flex flex-col items-center justify-center min-h-[48px] min-w-[56px] text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors"
              >
                <Layers className="w-5 h-5 mb-0.5" />
                <span>Home</span>
              </Link>
              <Link
                to="/app/jobs"
                activeProps={{ className: "text-blue-600 font-semibold" }}
                className="flex flex-col items-center justify-center min-h-[48px] min-w-[56px] text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors"
              >
                <Briefcase className="w-5 h-5 mb-0.5" />
                <span>Jobs</span>
              </Link>
              <Link
                to="/app/applications"
                activeProps={{ className: "text-blue-600 font-semibold" }}
                className="flex flex-col items-center justify-center min-h-[48px] min-w-[56px] text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors"
              >
                <FileText className="w-5 h-5 mb-0.5" />
                <span>Applications</span>
              </Link>
              <Link
                to="/app/profile"
                activeProps={{ className: "text-blue-600 font-semibold" }}
                className="flex flex-col items-center justify-center min-h-[48px] min-w-[56px] text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors"
              >
                <UserIcon className="w-5 h-5 mb-0.5" />
                <span>Profile</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/"
                activeOptions={{ exact: true }}
                activeProps={{ className: "text-blue-600 font-semibold" }}
                className="flex flex-col items-center justify-center min-h-[48px] min-w-[56px] text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors"
              >
                <Home className="w-5 h-5 mb-0.5" />
                <span>Home</span>
              </Link>
              <Link
                to="/jobs"
                activeProps={{ className: "text-blue-600 font-semibold" }}
                className="flex flex-col items-center justify-center min-h-[48px] min-w-[56px] text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors"
              >
                <Briefcase className="w-5 h-5 mb-0.5" />
                <span>Jobs</span>
              </Link>
              <Link
                to="/login"
                activeProps={{ className: "text-blue-600 font-semibold" }}
                className="flex flex-col items-center justify-center min-h-[48px] min-w-[56px] text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors"
              >
                <LogIn className="w-5 h-5 mb-0.5" />
                <span>Sign In</span>
              </Link>
              <Link
                to="/register"
                activeProps={{ className: "text-blue-600 font-semibold" }}
                className="flex flex-col items-center justify-center min-h-[48px] min-w-[56px] text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors"
              >
                <UserPlus className="w-5 h-5 mb-0.5" />
                <span>Register</span>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Sign Out Warning Dialog */}
      <SignOutDialog
        open={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
      />

      {/* Account Security / Change Password Dialog */}
      <ChangePasswordModal
        open={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>MEGS Recruitment Platform &copy; {new Date().getFullYear()}</span>
          <span className="text-slate-400">DOLE PEA Licensed • ISO 9001:2015 Certified</span>
        </div>
      </footer>
    </div>
  );
};
