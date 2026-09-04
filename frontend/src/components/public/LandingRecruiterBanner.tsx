import React from "react";
import { Link } from "@tanstack/react-router";
import { Mail, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";

export const LandingRecruiterBanner: React.FC = () => {
  return (
    <section className="py-16 sm:py-20 bg-slate-900 text-white relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e40af_1px,transparent_1px)] [background-size:20px_20px] opacity-20 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="bg-gradient-to-r from-blue-950/80 via-slate-900 to-slate-900 border border-blue-900/60 rounded-3xl p-8 sm:p-12 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-900/60 border border-blue-700/50 text-blue-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Direct Recruiter Matching</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Let opportunities find you.
            </h2>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Don't have time to search job boards every day? Create your candidate profile, upload your resume once, and our talent acquisition specialists will send direct job invitations tailored to your verified background and salary expectations.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2 text-xs text-blue-200">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>100% Free for Applicants</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-blue-400" />
                <span>Direct Recruiter Notes</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 w-full sm:w-auto">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl shadow-lg transition-all text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <span>Create Candidate Profile</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/app/jobs"
              className="inline-flex items-center justify-center px-6 py-3.5 bg-slate-800/90 hover:bg-slate-800 text-slate-200 hover:text-white text-sm font-medium rounded-xl border border-slate-700 transition-colors text-center"
            >
              <span>Explore Current Openings</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
