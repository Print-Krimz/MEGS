import React from "react";
import { Award, CheckSquare, Target, Compass, ArrowRight } from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";

export const LandingAbout: React.FC = () => {
  return (
    <section id="about" className="py-16 sm:py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header & Main Company Intro */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center mb-16">
          
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-mono font-bold uppercase tracking-wider">
              Company Background & Heritage
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
              Trusted Workforce Partner to the Philippines&apos; Top 1,000 Corporations
            </h2>
            
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Founded in <strong className="text-slate-900 font-semibold">May 1997</strong>, <strong className="text-slate-900 font-semibold">MAR EMPLOYMENT FOR GOOD SERVICES INC. (MEGS)</strong> has steadily expanded to rank among the nation&apos;s most reputable manpower and human resources organizations. For nearly three decades, we have provided leading Philippine enterprises with the strategic people management, compliant employment governance, and disciplined manpower required to thrive in a competitive and evolving job-contracting market.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-2xl font-black text-teal-800 font-mono block">May 1997</span>
                <span className="text-xs text-slate-600 font-medium mt-1 block">Founded & Serving Nationwide</span>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-2xl font-black text-teal-800 font-mono block">Top 1,000</span>
                <span className="text-xs text-slate-600 font-medium mt-1 block">Philippine Corporate Clientele</span>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-2xl font-black text-teal-800 font-mono block">6 Branches</span>
                <span className="text-xs text-slate-600 font-medium mt-1 block">Luzon, Visayas & Mindanao</span>
              </div>
            </div>
          </div>

          {/* MEGS Seal & Brand Mark */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center p-8 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <div className="relative w-44 h-44 mb-4 flex items-center justify-center bg-white rounded-full p-2 border border-slate-200 shadow-sm">
              <img
                src="/images/canva-ref/megs-seal.jpg"
                alt="MEGS Inc. - Better People for Better Result"
                className="w-full h-full object-contain rounded-full"
                loading="lazy"
              />
            </div>
            <h3 className="text-sm font-bold font-mono uppercase text-slate-900 tracking-wide">
              MAR Employment for Good Services Inc.
            </h3>
            <p className="text-xs font-mono text-teal-700 font-semibold mt-1">
              &ldquo;Better People for Better Result&rdquo;
            </p>
          </div>

        </div>

        {/* Mission and 5-Year Vision Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Mission Card */}
          <div className="p-8 bg-slate-900 text-white rounded-xl border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-teal-900/80 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-5">
                <Target className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-teal-400 block mb-2">
                Corporate Mission
              </span>
              <h3 className="text-xl font-bold tracking-tight text-white mb-3">
                Empowering Filipino Enterprise
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed font-sans">
                &ldquo;To provide Filipino businesses with only the best trained and qualified employees available in the country.&rdquo;
              </p>
            </div>
            <div className="pt-6 mt-6 border-t border-slate-800 text-xs text-slate-400 font-mono">
              Comprehensive recruitment, rigorous screening, and certified candidate onboarding.
            </div>
          </div>

          {/* Vision Card */}
          <div className="p-8 bg-slate-50 text-slate-900 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-teal-100 border border-teal-200 flex items-center justify-center text-teal-800 mb-5">
                <Compass className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-teal-700 block mb-2">
                5-Year Strategic Vision
              </span>
              <h3 className="text-xl font-bold tracking-tight text-slate-900 mb-3">
                Better People for Better Results
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed font-sans">
                &ldquo;To deliver &lsquo;Better people for better results&rsquo; to 200 client firms and provide a great employment experience to 15,000 deployed personnel across the Philippines.&rdquo;
              </p>
            </div>
            <div className="pt-6 mt-6 border-t border-slate-200 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500">Target: 200 Firms · 15,000 Personnel</span>
              <a
                href="#contact"
                onClick={(e) => scrollToSection(e, "#contact")}
                className="text-teal-800 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Partner With Us</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
