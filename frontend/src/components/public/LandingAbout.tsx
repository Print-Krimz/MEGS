import React from "react";
import { Target, Compass, ArrowRight } from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";

export const LandingAbout: React.FC = () => {
  return (
    <section id="about" className="py-16 sm:py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header & Main Company Intro */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center mb-16">
          
          <div className="lg:col-span-8 space-y-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Company Background & Heritage
            </p>
            
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0f294a] tracking-tight font-sans">
              Trusted Workforce Partner to the Philippines&apos; Top 1,000 Corporations
            </h2>
            
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-sans">
              Founded in <strong className="text-slate-900 font-semibold">May 1997</strong>, <strong className="text-slate-900 font-semibold">MAR EMPLOYMENT FOR GOOD SERVICES INC. (MEGS)</strong> has steadily expanded to rank among the nation&apos;s most reputable manpower and human resources organizations. For nearly three decades, we have provided leading Philippine enterprises with the strategic people management, compliant employment governance, and disciplined manpower required to thrive in a competitive and evolving job-contracting market.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-2xl font-bold text-[#0f294a] block">May 1997</span>
                <span className="text-xs text-slate-600 font-medium mt-1 block font-sans">Founded & Serving Nationwide</span>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-2xl font-bold text-[#0f294a] block">Top 1,000</span>
                <span className="text-xs text-slate-600 font-medium mt-1 block font-sans">Philippine Corporate Clientele</span>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-2xl font-bold text-[#0f294a] block">6 Branches</span>
                <span className="text-xs text-slate-600 font-medium mt-1 block font-sans">Luzon, Visayas & Mindanao</span>
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
            <h3 className="text-sm font-bold uppercase text-[#0f294a] tracking-wide">
              MAR Employment for Good Services Inc.
            </h3>
            <p className="text-xs text-slate-600 font-medium mt-1">
              &ldquo;Better People for Better Result&rdquo;
            </p>
          </div>

        </div>

        {/* Mission and 5-Year Vision Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Mission Card */}
          <div className="p-8 bg-slate-50/70 text-slate-900 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#0f294a] flex items-center justify-center border border-blue-100/60">
                  <Target className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Corporate Mission
                </span>
              </div>
              <h3 className="text-xl font-bold tracking-tight text-[#0f294a] mb-3 font-sans">
                Empowering Filipino Enterprise
              </h3>
              <blockquote className="text-sm text-slate-600 leading-relaxed italic border-l-2 border-blue-600/60 pl-3.5 my-2 font-sans">
                &ldquo;To provide Filipino businesses with only the best trained and qualified employees available in the country.&rdquo;
              </blockquote>
            </div>
          </div>

          {/* Vision Card */}
          <div className="p-8 bg-slate-50/70 text-slate-900 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#0f294a] flex items-center justify-center border border-blue-100/60">
                  <Compass className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  5-Year Strategic Vision
                </span>
              </div>
              <h3 className="text-xl font-bold tracking-tight text-[#0f294a] mb-3 font-sans">
                Better People for Better Results
              </h3>
              <blockquote className="text-sm text-slate-600 leading-relaxed italic border-l-2 border-blue-600/60 pl-3.5 my-2 font-sans">
                &ldquo;To deliver &lsquo;Better people for better results&rsquo; to 200 client firms and provide a great employment experience to 15,000 deployed personnel across the Philippines.&rdquo;
              </blockquote>
            </div>
            <div className="pt-6 mt-6 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Target: 200 Client Firms &middot; 15,000 Personnel</span>
              <a
                href="#contact"
                onClick={(e) => scrollToSection(e, "#contact")}
                className="text-[#0f294a] font-semibold hover:text-blue-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
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
