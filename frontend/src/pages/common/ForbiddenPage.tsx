import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Role } from '../../lib/types/enums';

export default function ForbiddenPage() {
  const { isAuthenticated, role, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Smart dashboard routing based on authenticated user's role
  let dashboardPath = '/login';
  if (isAuthenticated) {
    if (role === Role.ADMINISTRATOR) {
      dashboardPath = '/admin/dashboard';
    } else if (role === Role.TALENT_ACQUISITION) {
      dashboardPath = '/ta/dashboard';
    } else {
      dashboardPath = '/app/dashboard';
    }
  }

  const handleSwitchAccount = async () => {
    try {
      await logout();
    } catch {
      // Ignore errors on signout
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const formatRoleName = (r: Role | null) => {
    if (!r) return 'UNAUTHENTICATED';
    switch (r) {
      case Role.ADMINISTRATOR:
        return 'ADMINISTRATOR';
      case Role.TALENT_ACQUISITION:
        return 'TALENT ACQUISITION';
      case Role.APPLICANT:
        return 'APPLICANT';
      default:
        return String(r);
    }
  };

  return (
    <div
      data-testid="forbidden-page"
      className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 select-none relative overflow-hidden"
    >
      {/* Subtle crimson warning radial gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(225,29,72,0.15),rgba(255,255,255,0))] pointer-events-none" />

      <div className="max-w-lg w-full bg-slate-800/90 backdrop-blur border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 relative z-10">
        {/* Monospace System Header */}
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
          <div className="flex items-center space-x-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <span className="font-mono text-xs text-slate-400 uppercase tracking-widest">
              SYSTEM SECURITY // ACCESS_DENIED
            </span>
          </div>
          <div className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/60">
            HTTP 403
          </div>
        </div>

        {/* Visual Icon & Error Title */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans mt-3">
              Access Restricted
            </h1>
            <p className="text-base text-rose-300/90 max-w-md mx-auto leading-relaxed mt-2 font-mono text-sm">
              403 — Access Restricted. Your user account does not have sufficient permissions to access this administrative or operational workspace.
            </p>
          </div>
        </div>

        {/* User Identity & Role Badge Diagnostics */}
        <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700/60 text-left font-mono text-xs space-y-2 text-slate-300">
          <div className="flex justify-between items-center text-slate-400 pb-1.5 border-b border-slate-800">
            <span>IDENTITY_TOKEN_SUMMARY</span>
            <span className="text-xs text-rose-400 font-semibold">POLICY_RESTRICTION</span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-400">CURRENT_ROLE:</span>
            <span
              data-testid="user-role-badge"
              className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-rose-900/40 text-rose-300 border border-rose-700/60"
            >
              {formatRoleName(role)}
            </span>
          </div>

          {user?.email && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">ACTIVE_USER:</span>
              <span className="text-slate-200 truncate max-w-[200px]" title={user.email}>
                {user.email}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-slate-400">TARGET_RESOURCE:</span>
            <span className="text-slate-400 truncate max-w-[200px]">
              {location.pathname || '/restricted'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <Link
            to={dashboardPath}
            data-testid="return-dashboard-btn"
            className="flex-1 h-11 px-6 text-sm font-semibold rounded-xl bg-teal-700 hover:bg-teal-800 text-white inline-flex items-center justify-center gap-2 shadow-md hover:shadow-teal-900/30 transition duration-150 text-center"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Return to My Dashboard</span>
          </Link>

          <button
            type="button"
            onClick={handleSwitchAccount}
            data-testid="switch-account-btn"
            className="flex-1 h-11 px-6 text-sm font-semibold rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-700 text-slate-200 hover:text-white inline-flex items-center justify-center gap-2 border border-slate-600 transition duration-150 shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign In with Different Account</span>
          </button>
        </div>
      </div>
    </div>
  );
}
