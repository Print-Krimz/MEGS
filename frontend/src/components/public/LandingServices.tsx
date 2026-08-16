import React from "react";
import { UserCheck, Truck, FileText, UserCog, ArrowRight } from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";

export const LandingServices: React.FC = () => {
  const services = [
    {
      number: "01",
      icon: UserCheck,
      title: "Recruitment & Staffing",
      description:
        "Source, screen, and select qualified personnel based strictly on client technical and workforce specifications.",
    },
    {
      number: "02",
      icon: Truck,
      title: "Manpower Deployment",
      description:
        "Efficiently coordinate onboarding, orientation, pre-employment compliance, and rapid physical deployment to client sites.",
    },
    {
      number: "03",
      icon: FileText,
      title: "Workforce Administration",
      description:
        "Manage 201 employee records, government statutory benefits (SSS, PhilHealth, Pag-IBIG), contracts, and documentation.",
    },
    {
      number: "04",
      icon: UserCog,
      title: "Workforce Coordination",
      description:
        "Provide dedicated on-site service coordinators who assist client management with daily attendance, discipline, and workforce operational needs.",
    },
  ];

  return (
    <section id="services" className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-mono font-bold uppercase tracking-wider mb-3">
              What We Do
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
              Core Manpower & Workforce Services
            </h2>
            <p className="mt-2 text-sm text-slate-600 max-w-2xl">
              End-to-end workforce management designed to eliminate staffing bottlenecks and ensure operational continuity.
            </p>
          </div>
          <a
            href="#contact"
            onClick={(e) => scrollToSection(e, "#contact")}
            className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-teal-800 hover:text-teal-900 focus:outline-none transition-transform hover:translate-x-0.5 cursor-pointer"
          >
            <span>Request Service Proposal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* 4 Core Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.number}
                className="bg-white border border-slate-300 p-6 flex flex-col justify-between relative group hover:border-teal-700 transition-all glide-hover shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-bold text-slate-400">
                      {service.number}
                    </span>
                    <div className="w-8 h-8 bg-slate-100 group-hover:bg-teal-50 border border-slate-200 group-hover:border-teal-200 flex items-center justify-center transition-colors">
                      <Icon className="w-4 h-4 text-slate-700 group-hover:text-teal-800" />
                    </div>
                  </div>
                  <h3 className="text-sm font-bold font-mono uppercase text-slate-900 tracking-tight mb-2">
                    {service.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {service.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
