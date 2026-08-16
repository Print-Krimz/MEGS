import React, { useState } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  ClipboardList,
  Sparkles,
  Calendar,
  Building2,
  FileCheck2,
  Send,
  IdCard,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BriefcaseBusiness,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { NotificationBell, RealtimeToastContainer, SignOutDialog } from "../components/common";
import { getInitials } from "../lib/utils";
import { Role } from "../lib/types/enums";

export const TALayout: React.FC = () => {
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
  const fullName = profile ? `${profile.firstName} ${profile.lastName}` : user?.email || "Recruiter";
  const initials = getInitials(profile?.firstName, profile?.lastName);

  const navSections = [
    {
      label: "RECRUITMENT OPS",
      items: [
        { to: "/ta", label: "Operations Dashboard", icon: LayoutDashboard },
        { to: "/ta/applications", label: "Applications Pipeline", icon: Users },
        { to: "/ta/jobs", label: "Job Postings", icon: Briefcase },
        { to: "/ta/mrfs", label: "Manpower Requests (MRF)", icon: ClipboardList },
      ],
    },
    {
      label: "SOURCING & EVALUATION",
      items: [
        { to: "/ta/talent-pool", label: "Talent Pool", icon: Sparkles },
        { to: "/ta/interviews", label: "Interview Schedules", icon: Calendar },
        { to: "/ta/clients", label: "Clients & Endorsements", icon: Building2 },
      ],
    },
    {
      label: "POST-HIRE & DEPLOYMENT",
      items: [
        { to: "/ta/compliance", label: "201 Compliance SLA", icon: FileCheck2 },
        { to: "/ta/deployments", label: "Site Deployments", icon: Send },
        { to: "/ta/employees", label: "Personnel / Digital 201", icon: IdCard },
      ],
    },
    {
      label: "INTELLIGENCE",
      items: [
        { to: "/ta/analytics", label: "Analytics & Reports", icon: BarChart3 },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <RealtimeToastContainer toasts={activeToasts} onDismiss={dismissToast} />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 bg-slate-950 text-slate-300 flex flex-col border-r border-slate-800 transition-all duration-150 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-4 bg-slate-950 border-b border-slate-800">
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-teal-600 text-white flex items-center justify-center font-bold">
                <BriefcaseBusiness className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <div className="text-xs font-bold text-white tracking-wider font-mono uppercase">MEGS OPS</div>
                <div className="text-[10px] text-teal-400 font-mono uppercase">Talent Acquisition</div>
              </div>
            </div>
          )}

          {collapsed && (
            <div className="w-full flex justify-center">
              <div className="w-7 h-7 bg-teal-600 text-white flex items-center justify-center font-bold">
                <BriefcaseBusiness className="w-4 h-4" />
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
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
          {navSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {!collapsed && (
                <div className="px-2 text-[10px] font-semibold text-slate-400 tracking-wider uppercase font-mono">
                  {section.label}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      activeProps={{
                        className: "bg-teal-700 text-white font-medium border-l-2 border-teal-400",
                      }}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-850 transition-colors"
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

        {/* User Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 bg-slate-800 text-teal-400 border border-slate-700 flex items-center justify-center text-xs font-mono font-bold shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <div className="overflow-hidden leading-tight">
                <div className="text-xs font-medium text-white truncate">{fullName}</div>
                <div className="text-[10px] text-slate-400 truncate font-mono">
                  {user?.role === Role.ADMINISTRATOR ? "ADMIN / TA" : "RECRUITER"}
                </div>
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
        {/* Top Operational Bar */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-300 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 bg-teal-600" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
              MEGS RECRUITMENT OPERATIONS SYSTEM
            </span>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={markAsRead}
              viewAllLink="/ta/notifications"
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
