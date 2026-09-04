import React from "react";
import { ArrowRight, CheckCircle2, ShieldCheck, MapPin, Building2 } from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";

export const LandingHero: React.FC = () => {
  return (
    <section
      id="home"
      className="relative bg-slate-900 text-white border-b border-slate-800 overflow-hidden"
    >
      {/* Subtle grid background texture */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:16px_16px]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Main Content Column */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Trust Pill / Agency Meta */}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800/90 border border-slate-700 text-teal-400 font-mono text-[11px] uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Established May 1997 • DOLE Compliant</span>
            </div>

            {/* Corporate Name & Tagline */}
            <div className="space-y-2">
              <p className="text-xs sm:text-sm font-mono font-bold uppercase tracking-widest text-slate-400">
                MAR EMPLOYMENT FOR GOOD SERVICES INC.
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans">
                Better People. <br />
                <span className="text-teal-400">Better Results.</span>
              </h1>
            </div>

            {/* Subheading */}
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl font-normal leading-relaxed">
              Professional manpower and workforce solutions connecting qualified Filipino workers with industry-leading businesses across the Philippines.
            </p>

            {/* Quick Proof Points */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs text-slate-300 font-mono">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span>27+ Years Experience</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Nationwide Network</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Full HR Support</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4">
              <a
                href="/register"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white text-xs sm:text-sm font-mono font-bold uppercase tracking-wider border border-teal-500 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400 hover:-translate-y-0.5"
              >
                <span>View Job Openings</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#contact"
                onClick={(e) => scrollToSection(e, "#contact")}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs sm:text-sm font-mono font-bold uppercase tracking-wider border border-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-slate-500 hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Partner With MEGS</span>
              </a>
            </div>
          </div>

          {/* Corporate Profile Card / Snapshot Column */}
          <div className="lg:col-span-5">
            <div className="bg-slate-800 border border-slate-700 p-6 sm:p-8 space-y-6 glide-hover">
              <div className="border-b border-slate-700 pb-4">
                <span className="text-[11px] font-mono uppercase text-teal-400 tracking-wider font-bold">
                  Corporate Overview
                </span>
                <h2 className="text-xl font-bold text-white mt-1">
                  Trusted Workforce Partner
                </h2>
              </div>

              <div className="space-y-4 text-xs font-mono text-slate-300">
                <div className="flex justify-between items-center py-2 border-b border-slate-700/60">
                  <span className="text-slate-400 uppercase">Founded</span>
                  <span className="font-bold text-white">May 1997</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-700/60">
                  <span className="text-slate-400 uppercase">Headquarters</span>
                  <span className="font-bold text-white">Valenzuela City</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-700/60">
                  <span className="text-slate-400 uppercase">Branch Coverage</span>
                  <span className="font-bold text-white">Luzon • Visayas • Mindanao</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-700/60">
                  <span className="text-slate-400 uppercase">Specialization</span>
                  <span className="font-bold text-white">Industrial & Commercial Staffing</span>
                </div>
              </div>

              <div className="pt-2">
                <div className="p-3 bg-slate-900 border border-slate-700 text-[11px] text-slate-300 leading-relaxed">
                  <strong className="text-teal-300 font-semibold block mb-1">Corporate Standard</strong>
                  Committed to delivering reliable, compliant, and well-screened personnel to support manufacturing, logistics, retail, and commercial operations across the country.
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
