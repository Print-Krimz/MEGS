import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Sliders,
  FileSearch,
  Building2,
  ClipboardList,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { NotificationBell } from '../components/common/NotificationBell';
import { cn } from '../lib/utils';

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const adminNavItems = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'User Management', href: '/admin/users', icon: Users },
    { label: 'Candidate Scoring', href: '/admin/scoring', icon: Sliders },
    { label: 'Audit Trail', href: '/admin/audit-logs', icon: FileSearch },
  ];

  const operationsNavItems = [
    { label: 'Clients Oversight', href: '/admin/clients', icon: Building2 },
    { label: 'MRF Monitoring', href: '/admin/mrfs', icon: ClipboardList },
    { label: 'System Analytics', href: '/admin/analytics', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex selection:bg-teal-100 selection:text-teal-900">
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card shadow-subtle transition-all duration-200 lg:static',
          collapsed ? 'w-18' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <NavLink
            to="/admin/dashboard"
            className="flex items-center space-x-3 overflow-hidden group"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex-shrink-0 flex items-center justify-center text-white font-bold text-base shadow-sm group-hover:bg-slate-800 transition duration-150">
              <Shield className="w-4 h-4 text-teal-400" />
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="font-bold text-base tracking-tight text-foreground font-sans leading-none">
                  MEGS
                </span>
                <span className="text-xs font-mono text-muted-foreground mt-0.5">
                  Administrator Portal
                </span>
              </div>
            )}
          </NavLink>

          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 text-slate-500 hover:text-slate-700"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <div className="space-y-1">
            {!collapsed && (
              <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono mb-2">
                Administration
              </div>
            )}
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);

              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition duration-150 group relative',
                    isActive
                      ? 'bg-primary text-white shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-foreground hover:bg-slate-100'
                  )}
                >
                  <Icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-white' : 'text-slate-500 group-hover:text-foreground')} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </div>

          <div className="space-y-1">
            {!collapsed && (
              <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono mb-2">
                Recruitment Oversight
              </div>
            )}
            {operationsNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);

              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition duration-150 group relative',
                    isActive
                      ? 'bg-primary text-white shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-foreground hover:bg-slate-100'
                  )}
                >
                  <Icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-white' : 'text-slate-500 group-hover:text-foreground')} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Footer controls & Collapse toggle */}
        <div className="p-3 border-t border-border space-y-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-full items-center justify-center min-h-[38px] py-2.5 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition duration-150"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <div className="flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse</span>
              </div>
            )}
          </button>

          <div
            className={cn(
              'flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200/60',
              collapsed && 'justify-center p-1.5'
            )}
          >
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center flex-shrink-0">
              {user?.email ? user.email.charAt(0).toUpperCase() : 'A'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0 truncate">
                <div className="font-semibold text-sm text-slate-800 truncate">{user?.email}</div>
                <div className="text-xs text-slate-500 font-medium uppercase font-mono">System Admin</div>
              </div>
            )}
            <button
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 transition duration-150 flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 px-6 bg-card border-b border-border flex items-center justify-between sticky top-0 z-30 shadow-subtle">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-slate-600 hidden sm:inline-block">
              MEGS Administration Console &middot; Governance & Controls
            </span>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
