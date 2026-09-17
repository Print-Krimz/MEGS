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
    <div className="min-h-screen flex flex-col justify-between bg-[#F7F9FC] px-4 py-6 sm:px-6 lg:px-8">
      {/* Top Back Navigation Bar */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-4">
        {backDest ? (
          <Link
            to={backDest.to}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#627D98] hover:text-[#0B315D] transition-colors group py-2 px-3 rounded-lg hover:bg-white border border-transparent hover:border-[#D9E2EC]"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>{backDest.label}</span>
          </Link>
        ) : (
          <div className="text-xs text-[#627D98] font-medium">Account Security Update</div>
        )}

        <div className="flex items-center gap-4">
          <Link
            to={portalHome}
            className="text-xs text-[#627D98] hover:text-[#102A43] transition-colors hidden sm:inline-block font-medium"
          >
            MAR Employment for Good Services Inc.
          </Link>

          {isAuthenticated && (
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 text-xs text-[#627D98] hover:text-[#DC2626] font-medium py-1 px-2.5 rounded-lg hover:bg-[#EAF0F7] transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </header>

      {/* Center Auth Card */}
      <main className="sm:mx-auto sm:w-full sm:max-w-[460px] my-auto w-full py-4">
        <div className="text-center mb-6">
          <Link to={portalHome} className="inline-block group focus:outline-none">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#102A43] group-hover:text-[#0B315D] transition-colors font-sans">
              MEGS
            </h1>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#627D98] mt-1">
              Recruitment & Manpower Services
            </p>
          </Link>
        </div>

        <div className="bg-white py-8 px-6 sm:px-8 rounded-xl border border-[#D9E2EC] shadow-xs">
          <Outlet />
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="max-w-4xl w-full mx-auto pt-6 text-center text-xs text-[#627D98]">
        © {new Date().getFullYear()} MAR Employment for Good Services Inc. • Licensed by DOLE
      </footer>
    </div>
  );
};
