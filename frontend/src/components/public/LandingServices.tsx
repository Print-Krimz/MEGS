import React from "react";
import { 
  UserCheck, 
  FileCheck, 
  Scale, 
  Users, 
  UserCog, 
  Calculator, 
  ShieldAlert, 
  ArrowRight,
  CheckCircle2
} from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";

export const LandingServices: React.FC = () => {
  const salientFeatures = [
    {
      num: "01",
      icon: UserCheck,
      title: "Complete Recruitment & Sourcing Relief",
      desc: "Client-Company is completely spared from the burdensome routines of hiring—from expensive advertising to rigorous interviews, competency testing, background checks, and candidate selection.",
    },
    {
      num: "02",
      icon: FileCheck,
      title: "Statutory Records & Benefits Administration",
      desc: "We maintain all 201 records and statutory government filings (SSS, PhilHealth, Pag-IBIG Fund, and ECC). MEGS assumes full responsibility for employee benefit claims, compensation for occupational injuries, and health documentation.",
    },
    {
      num: "03",
      icon: Scale,
      title: "Zero Legal Liabilities (DOLE D.O. 40, S.2003)",
      desc: "Workers are solely and exclusively employed by MEGS under a legitimate contractor-employee relationship. Client companies are legally insulated from separation or termination liabilities, with immediate worker replacement upon advice.",
    },
    {
      num: "04",
      icon: Users,
      title: "Labor Stability & Zero Collective Bargaining",
      desc: "Client-Company is spared from union demands, collective bargaining friction, or fringe benefit negotiations, ensuring smooth and uninterrupted operational workflow on client facilities.",
    },
    {
      num: "05",
      icon: UserCog,
      title: "Dedicated On-Site Service Coordinators",
      desc: "MEGS deploys specialized on-site coordinators to manage daily worker attendance, performance discipline, site safety, and immediate staffing requirements in close cooperation with client management.",
    },
    {
      num: "06",
      icon: Calculator,
      title: "Competitive Billing & Labor Code Rates",
      desc: "Reasonable, cost-effective billing rates. Overtime, night differentials, and work performed during rest days or legal holidays are precisely computed according to Philippine Labor Code standards.",
    },
  ];

  return (
    <section id="services" className="py-16 sm:py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-16 gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-mono font-bold uppercase tracking-wider mb-3">
              Services & Contractual Protections
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
              Salient Features of Our Manpower Services
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
              Designed to eliminate corporate staffing bottlenecks, guarantee DOLE compliance, and provide reliable, insured personnel across Philippine commercial and industrial operations.
            </p>
          </div>
          
          <a
            href="#contact"
            onClick={(e) => scrollToSection(e, "#contact")}
            className="inline-flex items-center gap-2 px-5 py-3 bg-[#0f294a] hover:bg-[#163b66] text-white text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-colors shrink-0 shadow-xs cursor-pointer"
          >
            <span>Request Service Proposal</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* 6 Salient Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {salientFeatures.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.num}
                className="bg-slate-50 border border-slate-200 hover:border-teal-700/60 rounded-xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-200 hover:shadow-sm group"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-xs font-mono font-bold text-slate-400 group-hover:text-teal-700 transition-colors">
                      {feat.num}
                    </span>
                    <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 group-hover:border-teal-300 flex items-center justify-center text-slate-700 group-hover:text-teal-800 transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <h3 className="text-base font-bold font-mono uppercase text-slate-900 tracking-tight mb-2">
                    {feat.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">
                    {feat.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Accident Insurance Card & Absorption Terms */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-900 text-white rounded-xl p-8 border border-slate-800">
          
          {/* Insurance Coverage Callout */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-teal-400" />
              <span className="text-xs font-mono uppercase tracking-wider font-bold text-teal-400">
                Statutory & Employee Protection
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Company-Provided Employee Accident Insurance
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Every deployed MEGS worker is covered by our comprehensive institutional accident insurance policy from Day 1 of assignment, safeguarding both worker welfare and client peace of mind:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-lg">
                <span className="text-xs font-mono text-slate-400 block uppercase">Death or Total Disability</span>
                <span className="text-2xl font-black text-teal-300 font-mono mt-1 block">₱100,000.00</span>
                <span className="text-[11px] text-slate-400 mt-1 block">Full principal coverage per personnel</span>
              </div>
              <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-lg">
                <span className="text-xs font-mono text-slate-400 block uppercase">Hospitalization Support</span>
                <span className="text-2xl font-black text-teal-300 font-mono mt-1 block">₱10,000.00</span>
                <span className="text-[11px] text-slate-400 mt-1 block">Emergency medical assistance coverage</span>
              </div>
            </div>
          </div>

          {/* Hiring / Permanent Absorption Policy */}
          <div className="lg:col-span-5 bg-slate-800/50 border border-slate-700/80 rounded-lg p-6 flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-teal-400 font-bold block mb-2">
                Client Absorption Terms
              </span>
              <h4 className="text-base font-bold text-white mb-2">
                Direct Permanent Hiring Provisions
              </h4>
              <ul className="space-y-2 text-xs text-slate-300 font-sans">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <span>Permanent hiring within first 6 months: 10% recruitment placement fee based on annual gross income and 13th month pay.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <span>Permanent absorption after 6 months of client deployment: <strong className="text-white font-semibold">100% Free of Charge</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <span>Immediate replacement guarantee for personnel who do not meet client performance criteria.</span>
                </li>
              </ul>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-700/80 text-[11px] font-mono text-slate-400">
              Department of Labor & Employment (DOLE) Certified.
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
