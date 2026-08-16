import React from "react";
import { Link } from "@tanstack/react-router";
import { Compass, ArrowLeft } from "lucide-react";

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center bg-white border border-slate-300 p-6">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-100 text-slate-700 mb-3 border border-slate-300">
          <Compass className="w-6 h-6" />
        </div>
        <div className="text-[10px] font-mono font-bold text-teal-800 uppercase tracking-widest mb-1">
          Error 404
        </div>
        <h1 className="text-base font-bold font-mono uppercase text-slate-950 mb-2">Resource Not Found</h1>
        <p className="text-xs text-slate-600 mb-5 font-sans leading-normal">
          The recruitment resource or target endpoint does not exist or has been relocated.
        </p>
        <div className="flex justify-center">
          <Link
            to="/"
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
