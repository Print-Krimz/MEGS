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
  const navLinks = [
    { to: "/app", label: "Dashboard", icon: Layers },
    { to: "/app/jobs", label: "Explore Jobs", icon: Briefcase },
    { to: "/app/applications", label: "My Applications", icon: FileText },
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
    <div className="min-h-screen bg-slate-100 flex flex-col overflow-x-hidden">
      <RealtimeToastContainer toasts={activeToasts} onDismiss={dismissToast} />

      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-300">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo & Mobile Menu Button */}
            <div className="flex items-center gap-3 sm:gap-8 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-1.5 text-slate-600 hover:text-slate-900 border border-slate-300 hover:bg-slate-50 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <Link to="/app" className="flex items-center text-slate-900 font-bold text-base sm:text-lg shrink-0">
                <span className="tracking-tight font-mono">MEGS Careers</span>
              </Link>

              {/* Primary Desktop Navigation Links */}
              <nav className="hidden md:flex items-center gap-1" aria-label="Main Applicant Navigation">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      activeOptions={{ exact: item.to === "/app" }}
                      activeProps={{ className: "bg-teal-700 text-white font-semibold border-b-2 border-teal-400" }}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                    >
                      <Icon className="w-3.5 h-3.5" />
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
              <div className="relative inline-block text-left pl-2 sm:pl-3 border-l border-slate-300" ref={accountMenuRef}>
                <button
                  ref={accountButtonRef}
                  id="applicant-account-button"
                  type="button"
                  onClick={() => setAccountMenuOpen((prev) => !prev)}
                  className="group min-h-11 flex items-center gap-2 sm:gap-2.5 p-1 sm:px-2 sm:py-1 rounded-md text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1"
                  aria-label={`Account menu for ${fullName}`}
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                  aria-controls="applicant-account-menu"
                >
                  <div className="w-7 h-7 bg-slate-800 text-teal-400 border border-slate-700 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <div className="hidden lg:block text-left leading-tight">
                    <div className="text-xs font-bold text-slate-900 truncate max-w-[140px]">
                      {fullName}
                    </div>
                    <div className="text-xs text-slate-500">Applicant</div>
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
                    className="absolute right-0 mt-1.5 w-64 bg-white shadow-modal border border-slate-300 z-50 overflow-hidden"
                  >
                    {/* User Identity Context Card */}
                    <div className="p-3 bg-slate-50 border-b border-slate-200">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-slate-800 text-teal-400 border border-slate-700 text-xs font-mono font-bold flex items-center justify-center shrink-0">
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
                        <span className="px-1.5 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-mono font-medium">
                          Applicant Portal
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
                        className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors focus-visible:outline-none focus-visible:bg-slate-100 focus-visible:text-slate-950 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700"
                      >
                        <UserIcon className="w-4 h-4 text-slate-500 shrink-0" />
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
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors focus-visible:outline-none focus-visible:bg-slate-100 focus-visible:text-slate-950 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700 text-left"
                      >
                        <Shield className="w-4 h-4 text-slate-500 shrink-0" />
                        <div className="flex flex-col text-left">
                          <span className="font-semibold text-slate-900">Account Security</span>
                          <span className="text-[11px] text-slate-500 font-normal">Password & access settings</span>
                        </div>
                      </button>
                    </div>

                    {/* Sign Out Action */}
                    <div className="border-t border-slate-200 py-1">
                      <button
                        type="button"
                        role="menuitem"
                        tabIndex={0}
                        ref={(el) => { menuItemsRef.current[2] = el; }}
                        onClick={() => {
                          setAccountMenuOpen(false);
                          setShowSignOutConfirm(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-rose-700 hover:bg-rose-50 hover:text-rose-900 transition-colors focus-visible:outline-none focus-visible:bg-rose-50 focus-visible:text-rose-900 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700"
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

        {/* Mobile Navigation Drawer / Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-3 py-3 space-y-1 shadow-lg animate-in slide-in-from-top-2 duration-150">
            {navLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  activeOptions={{ exact: item.to === "/app" }}
                  activeProps={{ className: "bg-teal-700 text-white font-semibold border-l-2 border-teal-400" }}
                  className="flex min-h-11 items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 min-w-0">
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
      <footer className="bg-white border-t border-slate-300 py-3 px-3 text-center text-sm text-slate-500">
        MEGS Recruitment &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
};
