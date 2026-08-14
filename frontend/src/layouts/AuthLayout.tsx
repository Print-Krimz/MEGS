import { Outlet, Link } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-teal-100 selection:text-teal-900">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center flex flex-col items-center">
        <Link to="/" className="inline-flex flex-col items-center group">
          <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground font-bold text-xl flex items-center justify-center shadow-sm group-hover:bg-primary-hover transition duration-150">
            M
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground font-sans mt-2">
            MEGS
          </span>
        </Link>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mt-0.5">
          Recruitment Operations
        </p>
      </div>

      {/* Form card container */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg md:max-w-xl">
        <div className="bg-card py-8 px-6 sm:px-10 shadow-subtle rounded-2xl border border-border">
          <Outlet />
        </div>
        <p className="text-xs text-slate-500 text-center font-medium mt-6">
          &copy; {new Date().getFullYear()} MEGS Recruitment Management System. All rights reserved.
        </p>
      </div>
    </div>
  );
}
