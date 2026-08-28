import React, { useState } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  FileText,
  User as UserIcon,
  LogOut,
  Layers,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { NotificationBell, RealtimeToastContainer, SignOutDialog } from "../components/common";
import { getInitials } from "../lib/utils";
import { applicantApi } from "../lib/api/applicant.api";

export const ApplicantLayout: React.FC = () => {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
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

  const navLinks = [
    { to: "/app", label: "Dashboard", icon: Layers },
    { to: "/app/jobs", label: "Explore Jobs", icon: Briefcase },
    { to: "/app/applications", label: "My Applications", icon: FileText },
    { to: "/app/profile", label: "My Profile", icon: UserIcon },
  ];

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
                className="md:hidden p-1.5 text-slate-600 hover:text-slate-900 border border-slate-300 hover:bg-slate-50 transition-colors shrink-0"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <Link to="/app" className="flex items-center text-slate-900 font-bold text-base sm:text-lg shrink-0">
                <span className="tracking-tight font-mono">MEGS Careers</span>
              </Link>

              {/* Primary Desktop Navigation Links */}
              <nav className="hidden md:flex items-center gap-1">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      activeOptions={{ exact: item.to === "/app" }}
                      activeProps={{ className: "bg-teal-700 text-white font-semibold border-b-2 border-teal-400" }}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right Tools & User Profile */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAsRead={markAsRead}
                viewAllLink="/app/notifications"
              />

              <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-slate-300">
                <div className="w-7 h-7 bg-slate-800 text-teal-400 border border-slate-700 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                  {initials}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-bold text-slate-900 truncate max-w-[140px]">
                    {fullName}
                  </div>
                  <div className="text-xs text-slate-500">Applicant</div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSignOutConfirm(true)}
                  className="min-h-11 min-w-11 p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
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
                  className="flex min-h-11 items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
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

      {/* Footer */}
      <footer className="bg-white border-t border-slate-300 py-3 px-3 text-center text-sm text-slate-500">
        MEGS Recruitment &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
};
