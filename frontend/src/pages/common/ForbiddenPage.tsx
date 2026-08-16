import React from "react";
import { Link } from "@tanstack/react-router";
import { ShieldX, ArrowLeft } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { Role } from "../../lib/types/enums";

export const ForbiddenPage: React.FC = () => {
  const { user } = useAuth();

  const getHomePath = () => {
    if (!user) return "/login";
    if (user.role === Role.ADMINISTRATOR) return "/admin";
    if (user.role === Role.TALENT_ACQUISITION) return "/ta";
    return "/app";
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center bg-white border border-slate-300 p-6">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-rose-50 text-rose-700 mb-3 border border-rose-300">
          <ShieldX className="w-6 h-6" />
        </div>
        <div className="text-[10px] font-mono font-bold text-rose-800 uppercase tracking-widest mb-1">
          Access Restricted (403)
        </div>
        <h1 className="text-base font-bold font-mono uppercase text-slate-950 mb-2">Insufficient Permissions</h1>
        <p className="text-xs text-slate-600 mb-5 font-sans leading-normal">
          Your account role (<span className="font-mono font-bold text-slate-900">{user?.role || "GUEST"}</span>) is not authorized to access this operational resource.
        </p>
        <div className="flex justify-center">
          <Link
            to={getHomePath()}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono uppercase tracking-wider transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Workspace</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
