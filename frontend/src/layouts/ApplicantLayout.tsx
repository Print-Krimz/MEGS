import React, { useState, useRef, useEffect } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  FileText,
  User,
  Shield,
  LogOut,
  Layers,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { NotificationBell, RealtimeToastContainer, SignOutDialog, ChangePasswordModal } from "../components/common";
import { getInitials } from "../lib/utils";
import { applicantApi } from "../lib/api/applicant.api";

import { normalizeTitleCase } from "../lib/text-case";

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
    handleToastClick,
  } = useRealtimeNotifications();

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
    { to: "/app/jobs", label: "Explore Jobs", icon: Briefcase },
    { to: "/app/applications", label: "My Applications", icon: FileText },
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-slate-900 selection:text-white">
      <RealtimeToastContainer toasts={activeToasts} onDismiss={dismissToast} onToastClick={handleToastClick} />

      {/* Top Navigation Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Mobile Menu Button */}
            <div className="flex items-center gap-3 sm:gap-6 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden min-h-11 min-w-11 inline-flex items-center justify-center text-slate-500 hover:text-slate-900 border border-slate-200 hover:bg-slate-100 transition-colors shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <Link
                to="/app"
                className="flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded-sm py-1 group shrink-0"
                aria-label="MEGS Candidate Portal Home"
              >
                <span className="font-black text-xl tracking-tight text-slate-900 font-sans leading-none">
                  MEGS
                </span>
                <span className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase mt-1">
                  Candidate Portal
                </span>
              </Link>

              {/* Primary Desktop Navigation Links */}
              <nav className="hidden md:flex items-center gap-1.5 ml-4" aria-label="Main Applicant Navigation">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      activeOptions={{ exact: item.to === "/app" }}
                      activeProps={{
                        className: "text-slate-900 bg-slate-100 font-bold border border-slate-200 shadow-2xs",
                      }}
                      className="flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                    >
                      <Icon className="w-4 h-4" />
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
                  className="group min-h-11 flex items-center gap-2 sm:gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-lg text-slate-900 hover:bg-slate-100 hover:text-slate-900 border border-transparent hover:border-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 cursor-pointer"
                  aria-label={`Account menu for ${fullName}`}
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                  aria-controls="applicant-account-menu"
                >
                  <div className="w-8 h-8 bg-slate-900 text-white rounded-lg text-xs font-mono font-bold flex items-center justify-center shrink-0 shadow-2xs">
                    {initials}
                  </div>
                  <div className="hidden lg:block text-left leading-tight">
                    <div className="text-xs font-bold text-slate-900 truncate max-w-[140px]">
                      {fullName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">Candidate</div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 group-hover:text-slate-900 transition-transform duration-150 shrink-0 ${
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
                    <div className="p-3.5 bg-slate-50 border-b border-slate-200">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-slate-900 text-white rounded-lg text-xs font-mono font-bold flex items-center justify-center shrink-0">
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
                    </div>

                    {/* Navigation Items */}
                    <div className="p-1">
                      <Link
                        to="/app/profile"
                        role="menuitem"
                        tabIndex={0}
                        ref={(el) => { menuItemsRef.current[0] = el; }}
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-900 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                      >
                        <User className="w-4 h-4 text-slate-500 shrink-0" />
                        <div className="flex flex-col text-left">
                          <span className="font-semibold text-slate-900">Profile & Resume</span>
                          <span className="text-[11px] text-slate-500 font-normal">Qualifications & clearances</span>
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
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-900 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 text-left cursor-pointer"
                      >
                        <Shield className="w-4 h-4 text-slate-500 shrink-0" />
                        <div className="flex flex-col text-left">
                          <span className="font-semibold text-slate-900">Account Security</span>
                          <span className="text-[11px] text-slate-500 font-normal">Password & login protection</span>
                        </div>
                      </button>
                    </div>

                    {/* Sign Out Action */}
                    <div className="border-t border-slate-200 p-1">
                      <button
                        type="button"
                        role="menuitem"
                        tabIndex={0}
                        ref={(el) => { menuItemsRef.current[2] = el; }}
                        onClick={() => {
                          setAccountMenuOpen(false);
                          setShowSignOutConfirm(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 hover:text-rose-900 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
                        <div className="flex flex-col text-left">
                          <span className="font-semibold text-rose-900">Sign Out</span>
                          <span className="text-[11px] text-rose-700/70 font-normal">End your current session</span>
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
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 shadow-md animate-in slide-in-from-top-2 duration-150">
            {navLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  activeOptions={{ exact: item.to === "/app" }}
                  activeProps={{ className: "bg-slate-900 text-white font-bold" }}
                  className="flex min-h-11 items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 min-w-0">
        <Outlet />
      </main>

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
      <footer className="bg-white border-t border-slate-200 py-6 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} MAR Employment for Good Services Inc. All rights reserved.</span>
          <span className="text-[11px] text-slate-500">DOLE Licensed Private Employment Agency • Valenzuela City</span>
        </div>
      </footer>
    </div>
  );
};
