import React from "react";
import { ShieldCheck, CheckCircle2, Users, Building2 } from "lucide-react";
import { HeroSearch } from "../applicant/HeroSearch";

export const LandingHero: React.FC = () => {
  return (
    <section className="relative bg-gradient-to-b from-blue-50/70 via-slate-50 to-white py-16 sm:py-20 lg:py-24 border-b border-slate-200/80 overflow-hidden">
      {/* Subtle background grid pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8">
        {/* Accreditation Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 shadow-xs text-xs font-semibold text-slate-700 mx-auto">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <span>DOLE-Licensed Placement Agency • Serving Jobseekers Since 1997</span>
        </div>

        {/* Main Headline & Subheadline */}
        <div className="space-y-4 max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.15] font-sans">
            Find the opportunity <br className="hidden sm:inline" />
            <span className="text-blue-600">that fits you.</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Discover verified career openings across industrial, logistics, engineering, technical, and corporate sectors in the Philippines.
          </p>
        </div>

        {/* Dual Search Widget */}
        <div className="pt-2">
          <HeroSearch targetPath="/app/jobs" />
        </div>

        {/* Trust Proof Points */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs sm:text-sm text-slate-600 font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>27+ Years Trusted Service</span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Verified Philippine Employers</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Direct Placement & Full HR Support</span>
          </div>
        </div>
      </div>
    </section>
  );
};
