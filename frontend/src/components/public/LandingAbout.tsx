import React from "react";
import { Award, CheckSquare, Users, Globe2 } from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";

export const LandingAbout: React.FC = () => {
  const highlights = [
    {
      icon: Award,
      title: "Established May 1997",
      description: "Over 27 years of dedicated track record providing compliant workforce management across the Philippines.",
    },
    {
      icon: CheckSquare,
      title: "Legitimate & DOLE Compliant",
      description: "Strictly adhering to Department of Labor and Employment statutory regulations, mandatory benefits, and labor laws.",
    },
    {
      icon: Users,
      title: "Complete HR Solutions",
      description: "From candidate screening and skills verification to deployment, payroll records, and on-site coordination.",
    },
    {
      icon: Globe2,
      title: "Nationwide Reach",
      description: "Strategically located branches in Central Luzon, Mega Manila, Southern Tagalog, Visayas, and Mindanao.",
    },
  ];

  return (
    <section id="about" className="py-16 sm:py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-mono font-bold uppercase tracking-wider mb-3">
            About The Company
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
            A Legacy of Reliable Manpower & Workforce Excellence
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            MAR EMPLOYMENT FOR GOOD SERVICES INC. (MEGS) is a premier Philippine manpower and human resource service provider. Since May 1997, MEGS has partnered with top-tier corporations to supply disciplined, skilled, and motivated personnel tailored to evolving operational demands.
          </p>
        </div>

        {/* 4 Key Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {highlights.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="bg-slate-50 border border-slate-200 p-6 flex flex-col justify-between hover:border-slate-300 glide-hover"
              >
                <div>
                  <div className="w-10 h-10 bg-teal-800 text-white flex items-center justify-center border border-teal-900 mb-4">
                    <Icon className="w-5 h-5 text-teal-100" />
                  </div>
                  <h3 className="text-sm font-bold font-mono uppercase text-slate-900 tracking-tight mb-2">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Corporate Commitment Statement */}
        <div className="mt-10 p-6 bg-slate-900 text-slate-200 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-teal-400 font-bold">
              Our Mission
            </span>
            <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-3xl">
              To empower Filipino job seekers with stable, dignified livelihood opportunities while providing our corporate partners with high-performing, reliable manpower solutions.
            </p>
          </div>
          <a
            href="#contact"
            onClick={(e) => scrollToSection(e, "#contact")}
            className="shrink-0 px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white text-xs font-mono font-bold uppercase tracking-wider border border-teal-600 transition-all hover:-translate-y-0.5 cursor-pointer"
          >
            Inquire Now
          </a>
        </div>

      </div>
    </section>
  );
};
