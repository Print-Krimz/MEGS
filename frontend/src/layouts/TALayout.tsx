import React, { useState } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  ClipboardList,
  Calendar,
  Building2,
  FileCheck2,
  Send,
  IdCard,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { NotificationBell, RealtimeToastContainer, SignOutDialog } from "../components/common";
import { getInitials } from "../lib/utils";
import { Role } from "../lib/types/enums";

export const TALayout: React.FC = () => {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
      label: "New hires and placement",
      items: [
        { to: "/ta/compliance", label: "Employment documents (201)", icon: FileCheck2 },
        { to: "/ta/deployments", label: "Work placements", icon: Send },
        { to: "/ta/employees", label: "Employee records (201)", icon: IdCard },
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
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileMenuOpen(false)}
                          activeOptions={{ exact: item.to === "/ta" }}
                          activeProps={{
                            className: "bg-teal-700 text-white font-medium border-l-2 border-teal-400",
                          }}
                          className="flex min-h-11 items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:text-white hover:bg-slate-850 transition-colors"
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

            {/* Mobile User Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-7 h-7 bg-slate-800 text-teal-400 border border-slate-700 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                  {initials}
                </div>
                <div className="overflow-hidden leading-tight">
                  <div className="text-xs font-medium text-white truncate">{fullName}</div>
                  <div className="text-xs text-slate-400 truncate">
                    {user?.role === Role.ADMINISTRATOR ? "Admin and talent acquisition" : "Recruiter"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowSignOutConfirm(true);
                }}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
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
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      activeOptions={{ exact: item.to === "/ta" }}
                      activeProps={{
                        className: "bg-teal-700 text-white font-medium border-l-2 border-teal-400",
                      }}
                      className="flex min-h-9 items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:text-white hover:bg-slate-850 transition-colors"
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
                <div className="text-xs text-slate-400 truncate">
                  {user?.role === Role.ADMINISTRATOR ? "Admin and talent acquisition" : "Recruiter"}
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
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-900 truncate max-w-[160px]">{fullName}</div>
              <div className="text-[10px] text-slate-500 font-mono truncate max-w-[160px]">{user?.email}</div>
            </div>
            <div className="text-right sm:hidden font-mono text-[10px] font-bold text-slate-900 bg-slate-100 border border-slate-300 px-1.5 py-0.5">
              {initials}
            </div>
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-[1600px] w-full mx-auto min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

