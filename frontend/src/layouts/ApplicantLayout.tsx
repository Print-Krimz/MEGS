import React, { useState } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import {
  Briefcase,
  FileText,
  User as UserIcon,
  LogOut,
  Layers,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { NotificationBell, RealtimeToastContainer, SignOutDialog } from "../components/common";
import { getInitials } from "../lib/utils";

export const ApplicantLayout: React.FC = () => {
  const { user } = useAuth();
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const {
    unreadCount,
    notifications,
    markAsRead,
    activeToasts,
    dismissToast,
  } = useRealtimeNotifications();

  const profile = user?.applicantProfile;
  const fullName = profile ? `${profile.firstName} ${profile.lastName}` : user?.email || "Applicant";
  const initials = getInitials(profile?.firstName, profile?.lastName);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <RealtimeToastContainer toasts={activeToasts} onDismiss={dismissToast} />

      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <div className="flex items-center gap-8">
              <Link to="/app" className="flex items-center gap-2.5 text-teal-900 font-bold text-base">
                <div className="w-7 h-7 bg-teal-700 text-white flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="font-mono tracking-tight uppercase">MEGS Careers</span>
              </Link>

              {/* Primary Navigation Links */}
              <nav className="hidden md:flex items-center gap-1">
                <Link
                  to="/app"
                  activeProps={{ className: "bg-teal-700 text-white font-semibold border-b-2 border-teal-400" }}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Dashboard</span>
                </Link>

                <Link
                  to="/app/jobs"
                  activeProps={{ className: "bg-teal-700 text-white font-semibold border-b-2 border-teal-400" }}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Explore Jobs</span>
                </Link>

                <Link
                  to="/app/applications"
                  activeProps={{ className: "bg-teal-700 text-white font-semibold border-b-2 border-teal-400" }}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>My Applications</span>
                </Link>

                <Link
                  to="/app/profile"
                  activeProps={{ className: "bg-teal-700 text-white font-semibold border-b-2 border-teal-400" }}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>My Profile</span>
                </Link>
              </nav>
            </div>

            {/* Right Tools & User Dropdown */}
            <div className="flex items-center gap-4">
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAsRead={markAsRead}
                viewAllLink="/app/notifications"
              />

              <div className="flex items-center gap-3 pl-3 border-l border-slate-300">
                <div className="w-7 h-7 bg-slate-800 text-teal-400 border border-slate-700 text-xs font-mono font-bold flex items-center justify-center">
                  {initials}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-bold text-slate-900 truncate max-w-[140px]">
                    {fullName}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">APPLICANT</div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSignOutConfirm(true)}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Sign Out Warning Dialog */}
      <SignOutDialog
        open={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-300 py-3 text-center text-xs font-mono text-slate-500">
        MEGS Recruitment & Manpower Management System &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
};
