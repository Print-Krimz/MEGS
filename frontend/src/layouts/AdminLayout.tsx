import React, { useState } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import {
  ShieldAlert,
  Users2,
  Sliders,
  Sparkles,
  Activity,
  History,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { NotificationBell, RealtimeToastContainer, SignOutDialog } from "../components/common";
import { getInitials } from "../lib/utils";

export const AdminLayout: React.FC = () => {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const {
    unreadCount,
    notifications,
    markAsRead,
    activeToasts,
    dismissToast,
  } = useRealtimeNotifications();

  const profile = user?.applicantProfile;
  const fullName = profile ? `${profile.firstName} ${profile.lastName}` : user?.email || "Administrator";
  const initials = getInitials(profile?.firstName, profile?.lastName);

  const adminNav = [
    { to: "/admin", label: "System Overview", icon: ShieldAlert },
    { to: "/admin/users", label: "User Management & Invites", icon: Users2 },
    { to: "/admin/scoring", label: "Candidate Scoring Weights", icon: Sliders },
    { to: "/admin/scoring/quality", label: "Scoring Quality & Metrics", icon: Sparkles },
    { to: "/admin/revalidation", label: "Score Reassessment Queue", icon: Activity },
    { to: "/admin/audit", label: "Security & Audit Logs", icon: History },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <RealtimeToastContainer toasts={activeToasts} onDismiss={dismissToast} />

      {/* Admin Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 bg-slate-950 text-slate-300 flex flex-col border-r border-slate-800 transition-all duration-150 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-4 bg-slate-900 border-b border-slate-800">
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-amber-600 text-white flex items-center justify-center font-bold">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <div className="text-xs font-bold text-white tracking-wider font-mono uppercase">MEGS ADMIN</div>
                <div className="text-[10px] text-amber-400 font-mono uppercase">System Administration</div>
              </div>
            </div>
          )}

          {collapsed && (
            <div className="w-full flex justify-center">
              <div className="w-7 h-7 bg-amber-600 text-white flex items-center justify-center font-bold">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {!collapsed && (
            <div className="px-2 pb-2 text-[10px] font-semibold text-slate-400 tracking-wider uppercase font-mono">
              ADMINISTRATION & AUDIT
            </div>
          )}

          {adminNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{
                  className: "bg-amber-600/90 text-white font-medium border-l-2 border-amber-300",
                }}
                className="flex items-center gap-2.5 px-2.5 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 bg-amber-950 text-amber-300 border border-amber-800 flex items-center justify-center text-xs font-mono font-bold shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <div className="overflow-hidden leading-tight">
                <div className="text-xs font-medium text-white truncate">{fullName}</div>
                <div className="text-[10px] text-amber-400 truncate font-mono">SYSTEM ADMINISTRATOR</div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowSignOutConfirm(true)}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Sign Out Warning Dialog */}
      <SignOutDialog
        open={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
      />

      {/* Main Workspace Layout */}
      <div className={`flex-1 flex flex-col transition-all duration-150 ${collapsed ? "pl-16" : "pl-64"}`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-300 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-mono font-bold uppercase">
              ADMINISTRATOR CONSOLE
            </div>
            <span className="text-xs font-mono text-slate-500 hidden sm:inline">
              Configuration, User Security & Audit Control
            </span>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={markAsRead}
              viewAllLink="/admin/notifications"
            />
            <div className="text-right">
              <div className="text-xs font-bold text-slate-900">{fullName}</div>
              <div className="text-[10px] text-slate-500 font-mono">{user?.email}</div>
            </div>
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
