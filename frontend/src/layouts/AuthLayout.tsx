import React from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { ArrowLeft, LogOut } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { Role } from "../lib/types/enums";

export const AuthLayout: React.FC = () => {
  const { isAuthenticated, user, mustChangePassword, logout } = useAuth();

  const getBackDestination = () => {
    if (!isAuthenticated) return { to: "/", label: "Back to MEGS Home" };
    if (mustChangePassword) return null;
    if (user?.role === Role.ADMINISTRATOR) return { to: "/admin", label: "Back to Admin Portal" };
    if (user?.role === Role.TALENT_ACQUISITION) return { to: "/ta", label: "Back to TA Portal" };
    return { to: "/app", label: "Back to Applicant Portal" };
  };

  const backDest = getBackDestination();
  const portalHome = !isAuthenticated || mustChangePassword
    ? "/"
    : user?.role === Role.ADMINISTRATOR
    ? "/admin"
    : user?.role === Role.TALENT_ACQUISITION
    ? "/ta"
    : "/app";

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 overflow-x-hidden">
      {/* Top Back Navigation Bar */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between pb-3 sm:pb-4">
        {backDest ? (
          <Link
            to={backDest.to}
            className="inline-flex items-center gap-1.5 sm:gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors group py-2 px-2 rounded-md hover:bg-white"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>{backDest.label}</span>
          </Link>
        ) : (
          <div className="text-xs text-slate-500 font-medium">Account Security Update</div>
        )}

        <div className="flex items-center gap-4">
          <Link
            to={portalHome}
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors hidden sm:inline-block"
          >
            MAR Employment for Good Services Inc.
          </Link>

          {isAuthenticated && (
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 font-medium py-1 px-2 rounded hover:bg-slate-100 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Center Auth Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md my-auto w-full">
        <div className="text-center mb-5 sm:mb-6">
          <Link to={portalHome} className="inline-block group focus:outline-none">
            <div className="inline-flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-sm shadow-xs">
                M
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 group-hover:text-blue-600 transition-colors">
                MEGS <span className="text-blue-600 font-semibold text-lg">Careers</span>
              </h1>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Candidate & Recruitment Portal
            </p>
          </Link>
          <p className="mt-2 text-xs sm:text-sm text-slate-600">
            Find the opportunity that fits you.
          </p>
        </div>

        <div className="bg-white py-6 px-5 sm:py-8 sm:px-8 rounded-2xl border border-slate-200/90 shadow-md">
          <Outlet />
        </div>
      </div>

      {/* Footer Branding */}
      <div className="max-w-4xl w-full mx-auto pt-4 sm:pt-6 text-center text-xs sm:text-sm text-slate-500">
        © {new Date().getFullYear()} MAR Employment for Good Services Inc. • DOLE-licensed agency
      </div>
    </div>
  );
};
