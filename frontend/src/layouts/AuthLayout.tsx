import React from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 overflow-x-hidden">
      {/* Top Back Navigation Bar */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between pb-3 sm:pb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 sm:gap-2 text-sm font-medium text-slate-600 hover:text-teal-800 transition-colors group py-2 px-2 rounded-md hover:bg-white"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to MEGS Home</span>
        </Link>

        <Link
          to="/"
          className="text-sm text-slate-500 hover:text-slate-800 transition-colors hidden sm:inline-block"
        >
          MAR Employment for Good Services Inc.
        </Link>
      </div>

      {/* Center Auth Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md my-auto w-full">
        <div className="text-center mb-5 sm:mb-6">
          <Link to="/" className="inline-block group focus:outline-none">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-slate-950 group-hover:text-teal-800 transition-colors">
              MEGS INC.
            </h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-1">
              Recruitment & Manpower Services
            </p>
          </Link>
          <p className="mt-2 text-sm text-slate-600">
            Find work and manage recruitment with confidence.
          </p>
        </div>

        <div className="bg-white py-6 px-4 sm:py-8 sm:px-10 rounded-lg border border-slate-200 shadow-sm">
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
