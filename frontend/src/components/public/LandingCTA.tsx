import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const LandingCTA: React.FC = () => {
  return (
    <section className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <span className="text-xs font-bold uppercase tracking-wider text-[#0f294a]">
          Take the Next Step
        </span>
        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Ready to find the opportunity that fits you?
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
          Create an applicant account to build your profile, upload your resume, and submit applications directly to verified employers nationwide.
        </p>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0f294a] hover:bg-[#163b66] text-white text-sm font-bold rounded-lg transition-colors border border-[#0f294a]"
          >
            <span>Create Candidate Account</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#jobs"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-white hover:bg-slate-100 text-slate-800 text-sm font-semibold rounded-lg transition-colors border border-slate-300"
          >
            Browse Open Jobs
          </a>
        </div>
      </div>
    </section>
  );
};
