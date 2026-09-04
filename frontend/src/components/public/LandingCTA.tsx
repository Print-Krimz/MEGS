import React from "react";
import { Link } from "@tanstack/react-router";
import { UserPlus, Search, ArrowRight } from "lucide-react";

export const LandingCTA: React.FC = () => {
  return (
    <section className="py-16 sm:py-20 bg-blue-600 text-white relative overflow-hidden">
      {/* Background circle accents */}
      <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-blue-500/40 blur-2xl pointer-events-none" />
      <div className="absolute -left-20 -top-20 w-80 h-80 rounded-full bg-blue-700/40 blur-2xl pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-6">
        <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          Ready to take the next step in your career?
        </h2>

        <p className="text-sm sm:text-base text-blue-100 max-w-2xl mx-auto leading-relaxed">
          Create your candidate account today to start applying for verified positions, getting interviewed, and tracking your job placement.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white text-blue-900 hover:bg-blue-50 text-sm font-extrabold rounded-xl shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <UserPlus className="w-4 h-4 text-blue-600" />
            <span>Create Candidate Account</span>
          </Link>

          <Link
            to="/app/jobs"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold rounded-xl border border-blue-500 transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>Browse All Open Jobs</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};
