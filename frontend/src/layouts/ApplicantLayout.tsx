import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  User,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { NotificationBell } from '../components/common/NotificationBell';
import { cn } from '../lib/utils';

export function ApplicantLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
    { label: 'Browse Jobs', href: '/app/jobs', icon: Briefcase },
    { label: 'My Applications', href: '/app/applications', icon: FileText },
    { label: 'My Profile', href: '/app/profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-teal-100 selection:text-teal-900">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-border bg-card shadow-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-8">
            <NavLink to="/app/dashboard" className="flex items-center space-x-3 group">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-base shadow-sm group-hover:bg-primary-hover transition duration-150">
                M
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base tracking-tight text-foreground font-sans leading-none">
                  MEGS
                </span>
                <span className="text-xs font-mono text-muted-foreground mt-0.5">
                  Applicant Portal
                </span>
              </div>
            </NavLink>

            {/* Desktop Nav Items */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition duration-150',
                        isActive
                          ? 'bg-teal-50 text-teal-800 font-semibold shadow-2xs border border-teal-200/60'
                          : 'text-slate-600 hover:text-foreground hover:bg-slate-100'
                      )
                    }
                  >
                    <Icon className="w-4.5 h-4.5" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            <NotificationBell />

            <div className="hidden sm:flex items-center gap-3 border-l border-border pl-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center border border-primary/20 flex-shrink-0">
                {user?.email ? user.email.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-foreground max-w-[240px] truncate">
                  {user?.email}
                </div>
                <div className="text-xs text-slate-500 font-medium capitalize">
                  {user?.role ? user.role.toLowerCase() : 'applicant'}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
              className="min-w-[36px] min-h-[36px] p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg flex items-center justify-center transition duration-150"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-card px-4 py-3 space-y-1 animate-in slide-in-from-top-2 duration-150">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition duration-150',
                      isActive
                        ? 'bg-teal-50 text-teal-800 font-semibold shadow-2xs border border-teal-200/60'
                        : 'text-slate-600 hover:bg-slate-100'
                    )
                  }
                >
                  <Icon className="w-4.5 h-4.5" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-4 text-center text-xs text-muted-foreground">
        MEGS Candidate Portal &bull; Professional Recruitment Operations
      </footer>
    </div>
  );
}
