import React from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { BriefcaseBusiness, ShieldCheck, ArrowLeft } from "lucide-react";

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 px-4 py-6 sm:px-6 lg:px-8">
      {/* Top Back Navigation Bar */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between pb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400 hover:text-teal-400 transition-colors group py-1 px-2 rounded-md hover:bg-slate-900 border border-transparent hover:border-slate-800"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to MEGS Home</span>
        </Link>

        <Link
          to="/"
          className="text-[11px] font-mono uppercase text-slate-500 hover:text-slate-300 transition-colors hidden sm:inline-block"
        >
          MAR EMPLOYMENT FOR GOOD SERVICES INC.
        </Link>
      </div>

      {/* Center Auth Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md my-auto">
        <div className="text-center mb-6">
          <Link to="/" className="inline-block group">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-teal-600 group-hover:bg-teal-500 text-white mb-3 transition-colors shadow-sm">
              <BriefcaseBusiness className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white font-mono uppercase group-hover:text-teal-300 transition-colors">
              MEGS Recruitment & Manpower
            </h1>
          </Link>
          <p className="mt-1 text-xs text-slate-400 font-mono tracking-wider">
            OPERATIONAL TALENT & DEPLOYMENT PORTAL
          </p>
        </div>

        <div className="bg-white py-8 px-6 border border-slate-300 sm:px-10 shadow-xl">
          <Outlet />
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-mono uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4 text-teal-400" />
          <span>Enterprise Secure Authentication</span>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="max-w-4xl w-full mx-auto pt-6 text-center text-[11px] text-slate-600 font-mono">
        © {new Date().getFullYear()} MAR Employment for Good Services Inc. • DOLE Licensed Agency
      </div>
    </div>
  );
};
