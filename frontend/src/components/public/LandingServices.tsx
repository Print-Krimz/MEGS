import React from "react";
import { ArrowRight } from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";

export const LandingServices: React.FC = () => {
  const salientFeatures = [
    {
      num: "01",
      title: "Complete Recruitment & Sourcing Relief",
      desc: "Client-Company is completely spared from the burdensome routines of hiring—from expensive advertising to rigorous interviews, competency testing, background checks, and candidate selection.",
    },
    {
      num: "02",
      title: "Statutory Records & Benefits Administration",
      desc: "We maintain all 201 records and statutory government filings (SSS, PhilHealth, Pag-IBIG Fund, and ECC). MEGS assumes full responsibility for employee benefit claims, compensation for occupational injuries, and health documentation.",
    },
    {
      num: "03",
      title: "Zero Legal Liabilities (DOLE D.O. 40, S.2003)",
      desc: "Workers are solely and exclusively employed by MEGS under a legitimate contractor-employee relationship. Client companies are legally insulated from separation or termination liabilities, with immediate worker replacement upon advice.",
    },
    {
      num: "04",
      title: "Labor Stability & Zero Collective Bargaining",
      desc: "Client-Company is spared from union demands, collective bargaining friction, or fringe benefit negotiations, ensuring smooth and uninterrupted operational workflow on client facilities.",
    },
    {
      num: "05",
      title: "Dedicated On-Site Service Coordinators",
      desc: "MEGS deploys specialized on-site coordinators to manage daily worker attendance, performance discipline, site safety, and immediate staffing requirements in close cooperation with client management.",
    },
    {
      num: "06",
      title: "Competitive Billing & Labor Code Rates",
      desc: "Reasonable, cost-effective billing rates. Overtime, night differentials, and work performed during rest days or legal holidays are precisely computed according to Philippine Labor Code standards.",
    },
  ];

  return (
    <section id="services" className="py-16 sm:py-20 bg-white border-b border-slate-200 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-10 gap-6">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
              Services & Contractual Protections
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0f294a] tracking-tight">
              Salient Features of Our Manpower Services
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
              Designed to eliminate corporate staffing bottlenecks, guarantee DOLE compliance, and provide reliable, insured personnel across Philippine commercial and industrial operations.
            </p>
          </div>
          
          <a
            href="#contact"
            onClick={(e) => scrollToSection(e, "#contact")}
            className="inline-flex items-center gap-2 px-5 py-3 bg-[#0f294a] hover:bg-[#163b66] text-white text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors shrink-0 shadow-xs cursor-pointer"
          >
            <span>Request Service Proposal</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* 6 Salient Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {salientFeatures.map((feat) => {
            return (
              <div
                key={feat.num}
                className="bg-slate-50 border border-slate-200 hover:border-[#0f294a] rounded-xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-200 hover:shadow-sm group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-200">
                    <span className="text-xs font-mono font-bold tracking-widest text-[#0f294a]">
                      {feat.num}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                      Standard Provision
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 tracking-tight mb-2">
                    {feat.title}
                  </h3>

                  <p className="text-sm text-slate-600 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Accident Insurance Card & Absorption Terms */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#0f294a] text-white rounded-xl p-8 border border-slate-800 shadow-xs">
          
          {/* Insurance Coverage Callout */}
          <div className="lg:col-span-7 space-y-4">
            <span className="text-xs uppercase tracking-wider font-semibold text-blue-300 block">
              Statutory &amp; Employee Protection
            </span>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
              Company-Provided Employee Accident Insurance
            </h3>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
              Every deployed MEGS worker is covered by our comprehensive institutional accident insurance policy from Day 1 of assignment, safeguarding both worker welfare and client peace of mind:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                <span className="text-xs text-slate-300 block font-medium">Death or Total Disability</span>
                <span className="text-2xl font-bold text-white font-mono mt-1 block">₱100,000.00</span>
                <span className="text-xs text-slate-400 mt-1 block">Full principal coverage per personnel</span>
              </div>
              <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                <span className="text-xs text-slate-300 block font-medium">Hospitalization Support</span>
                <span className="text-2xl font-bold text-white font-mono mt-1 block">₱10,000.00</span>
                <span className="text-xs text-slate-400 mt-1 block">Emergency medical assistance coverage</span>
              </div>
            </div>
          </div>

          {/* Hiring / Permanent Absorption Policy */}
          <div className="lg:col-span-5 bg-white/5 border border-white/10 rounded-lg p-6 flex flex-col justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider text-blue-300 font-semibold block mb-2">
                Client Absorption Terms
              </span>
              <h4 className="text-base font-bold text-white mb-3 font-sans">
                Direct Permanent Hiring Provisions
              </h4>
              <ul className="space-y-3 text-xs text-slate-200 font-sans">
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-300 shrink-0 mt-1.5" aria-hidden="true" />
                  <span>Permanent hiring within first 6 months: 10% recruitment placement fee based on annual gross income and 13th month pay.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-300 shrink-0 mt-1.5" aria-hidden="true" />
                  <span>Permanent absorption after 6 months of client deployment: <strong className="text-white font-semibold">100% Free of Charge</strong>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-300 shrink-0 mt-1.5" aria-hidden="true" />
                  <span>Immediate replacement guarantee for personnel who do not meet client performance criteria.</span>
                </li>
              </ul>
            </div>

            <div className="pt-4 mt-5 border-t border-white/10 text-xs text-slate-300 font-medium">
              Department of Labor &amp; Employment (DOLE) Certified
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
