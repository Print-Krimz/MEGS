import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Compass, ArrowLeft, Home } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Role } from '../../lib/types/enums';

export default function NotFoundPage() {
  const { isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Smart dashboard path detection based on role and auth state
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

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(dashboardPath);
    }
  };

  return (
    <div
      data-testid="not-found-page"
      className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 select-none relative overflow-hidden"
    >
      {/* Background Industrial Grid Accent */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(13,148,136,0.15),rgba(255,255,255,0))] pointer-events-none" />

      <div className="max-w-lg w-full bg-slate-800/90 backdrop-blur border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 relative z-10">
        {/* Monospace System Header */}
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
          <div className="flex items-center space-x-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <span className="font-mono text-xs text-slate-400 uppercase tracking-widest">
              SYSTEM STATUS // 404_NOT_FOUND
            </span>
          </div>
          <div className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-slate-700/80 text-slate-300 border border-slate-600">
            HTTP 404
          </div>
        </div>

        {/* Visual Icon & Error Code */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Compass className="w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans mt-3">
              Page Not Found
            </h1>
            <p className="text-base text-amber-300/90 max-w-md mx-auto leading-relaxed mt-2 font-mono text-sm">
              404 — Page Not Found. The resource you are looking for has been moved, archived, or does not exist.
            </p>
          </div>
        </div>

        {/* Technical Diagnostics Box */}
        <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700/60 text-left font-mono text-xs space-y-1.5 text-slate-300">
          <div className="flex justify-between items-center text-slate-400 pb-1.5 border-b border-slate-800">
            <span>REQUEST_DIAGNOSTICS</span>
            <span className="text-xs text-slate-400 font-semibold">UNRESOLVED_ROUTE</span>
          </div>
          <div className="pt-1 text-slate-300">
            <span className="text-slate-400">REQUESTED_URI: </span>
            <span className="text-amber-300 break-all">{location.pathname}{location.search}</span>
          </div>
          <div>
            <span className="text-slate-400">AUTH_STATUS: </span>
            <span className={isAuthenticated ? 'text-teal-400' : 'text-slate-400'}>
              {isAuthenticated ? `AUTHENTICATED (${role || 'USER'})` : 'GUEST / ANONYMOUS'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleGoBack}
            data-testid="go-back-btn"
            className="flex-1 h-11 px-6 text-sm font-semibold rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-700 text-slate-200 hover:text-white inline-flex items-center justify-center gap-2 border border-slate-600 transition duration-150 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>

          <Link
            to={dashboardPath}
            data-testid="back-to-dashboard-btn"
            className="flex-1 h-11 px-6 text-sm font-semibold rounded-xl bg-teal-700 hover:bg-teal-800 text-white inline-flex items-center justify-center gap-2 shadow-md hover:shadow-teal-900/30 transition duration-150 text-center"
          >
            <Home className="w-4 h-4" />
            <span>Back to Safety / Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
