import React from "react";
import { ShieldCheck, Award, Building2 } from "lucide-react";

export const LandingAffiliates: React.FC = () => {
  return (
    <section
      id="affiliates"
      className="bg-slate-900 border-b border-slate-800 text-white py-10"
      aria-label="Affiliations and Accreditations"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          
          {/* PJAR Group Affiliation */}
          <div className="flex items-start sm:items-center gap-4 flex-1">
            <div className="w-12 h-12 rounded-lg bg-teal-950 border border-teal-500/30 flex items-center justify-center shrink-0 text-teal-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-teal-400 font-bold px-2 py-0.5 bg-teal-950/80 border border-teal-800/50 rounded">
                  Conglomerate Network
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-white mt-1">
                A PJAR Group Company
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed max-w-md">
                MAR Employment for Good Services Inc. operates under the prestigious PJAR Group, delivering institutional stability and nationwide enterprise resources.
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden lg:block w-px h-16 bg-slate-800" />

          {/* PALSCON Membership & Accreditation */}
          <div className="flex items-start sm:items-center gap-5 flex-1">
            <div className="bg-white/95 p-2 rounded-lg border border-slate-700 shrink-0 shadow-xs flex items-center justify-center h-12 w-28">
              <img
                src="/images/canva-ref/palscon-logo.png"
                alt="PALSCON - Philippine Association of Local Service Contractors"
                className="max-h-8 max-w-full object-contain"
                loading="lazy"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-teal-400 font-bold px-2 py-0.5 bg-teal-950/80 border border-teal-800/50 rounded">
                  Industry Accreditation
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-white mt-1">
                Proud PALSCON Member
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed max-w-md">
                Member of the prestigious Philippine Association of Local Service Contractors. Adhering to the highest standards of professional ethics and labor practices.
              </p>
            </div>
          </div>

          {/* DOLE Statutory Assurance Badge */}
          <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700/80 px-4 py-3 rounded-lg shrink-0">
            <ShieldCheck className="w-5 h-5 text-teal-400 shrink-0" />
            <div className="text-left">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-300 block">
                DOLE D.O. 174 & D.O. 40
              </span>
              <span className="text-xs font-semibold text-slate-200">
                100% Statutorily Compliant
              </span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
