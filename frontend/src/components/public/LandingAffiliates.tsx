import React from "react";

export const LandingAffiliates: React.FC = () => {
  return (
    <section
      id="affiliates"
      className="bg-[#071322] border-b border-slate-800 text-white py-10"
      aria-label="Affiliations and Accreditations"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          
          {/* PJAR Group Affiliation */}
          <div className="flex items-start sm:items-center gap-4 flex-1">
            <div className="h-12 px-3.5 rounded-lg bg-slate-900 border border-slate-700/80 flex flex-col items-center justify-center shrink-0 tracking-wider shadow-xs min-w-[6.5rem]">
              <span className="font-mono text-sm font-black tracking-widest text-slate-100 uppercase">
                PJAR
              </span>
              <span className="text-[8px] font-mono tracking-widest text-blue-400 font-semibold uppercase -mt-0.5">
                GROUP
              </span>
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-blue-300 font-bold">
                Conglomerate Network
              </p>
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-white mt-1 font-sans">
                A PJAR Group Company
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed max-w-md font-sans">
                MAR Employment for Good Services Inc. operates under the prestigious PJAR Group, delivering institutional stability and nationwide enterprise resources.
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden lg:block w-px h-16 bg-slate-800" />

          {/* PALSCON Membership & Accreditation */}
          <div className="flex items-start sm:items-center gap-5 flex-1">
            <div className="bg-white p-2 rounded-lg border border-slate-700 shrink-0 shadow-xs flex items-center justify-center h-12 w-28">
              <img
                src="/images/canva-ref/palscon-logo.png"
                alt="PALSCON - Philippine Association of Local Service Contractors"
                className="max-h-8 max-w-full object-contain"
                loading="lazy"
              />
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-blue-300 font-bold">
                Industry Accreditation
              </p>
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-white mt-1 font-sans">
                Proud PALSCON Member
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed max-w-md font-sans">
                Member of the prestigious Philippine Association of Local Service Contractors. Adhering to the highest standards of professional ethics and labor practices.
              </p>
            </div>
          </div>

          {/* DOLE Statutory Assurance Badge */}
          <div className="flex items-center gap-3 bg-slate-900/90 border border-emerald-500/30 px-4 py-3 rounded-lg shrink-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div className="text-left">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 block">
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
