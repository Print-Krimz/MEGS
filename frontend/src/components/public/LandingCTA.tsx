import React from "react";
import { UserCheck, Building2, ArrowRight } from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";

export const LandingCTA: React.FC = () => {
  return (
    <section className="py-16 sm:py-20 bg-slate-100 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* For Applicants */}
          <div className="bg-white border border-slate-300 p-8 sm:p-10 flex flex-col justify-between shadow-2xs glide-hover">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-mono font-bold uppercase tracking-wider">
                <UserCheck className="w-3.5 h-3.5" />
                <span>For Job Seekers</span>
              </div>
              <h2 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">
                Looking for your next opportunity?
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Connect with legitimate Philippine employers. Access open vacancies across manufacturing, warehousing, retail, and office roles with guaranteed statutory benefits.
              </p>
            </div>
            <div className="pt-8">
              <a
                href="/register"
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white text-xs font-mono font-bold uppercase tracking-wider border border-teal-800 transition-all hover:-translate-y-0.5"
              >
                <span>Browse Job Openings</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* For Employers */}
          <div className="bg-slate-900 border border-slate-800 p-8 sm:p-10 flex flex-col justify-between text-white shadow-2xs glide-hover">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-800 border border-slate-700 text-teal-400 text-[11px] font-mono font-bold uppercase tracking-wider">
                <Building2 className="w-3.5 h-3.5" />
                <span>For Business Clients</span>
              </div>
              <h2 className="text-2xl font-bold font-sans text-white tracking-tight">
                Looking for reliable manpower?
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Scale your workforce with screened, qualified, and disciplined personnel. We handle recruitment, compliance, records, and on-site coordination.
              </p>
            </div>
            <div className="pt-8">
              <a
                href="#contact"
                onClick={(e) => scrollToSection(e, "#contact")}
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-white hover:bg-slate-100 text-slate-900 text-xs font-mono font-bold uppercase tracking-wider border border-white transition-all hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Partner With MEGS</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
