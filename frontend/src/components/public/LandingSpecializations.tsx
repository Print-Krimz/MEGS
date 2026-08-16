import React from "react";
import { CheckCircle } from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";

export const LandingSpecializations: React.FC = () => {
  const specializations = [
    { title: "Production Workers", category: "Manufacturing & Assembly" },
    { title: "Warehouse Crew", category: "Logistics & Storage" },
    { title: "Machine Operators", category: "Plant & Heavy Equipment" },
    { title: "QA/QC Personnel", category: "Quality Inspection" },
    { title: "Office Staff", category: "Administrative & Clerical" },
    { title: "Sales Promoters / Merchandisers", category: "Retail & Field Marketing" },
    { title: "Drivers", category: "Transport & Logistics" },
    { title: "Forklift Operators", category: "Material Handling" },
    { title: "Welders", category: "Fabrication & Technical" },
    { title: "Cashiers / Baggers", category: "Retail & Supermarket" },
    { title: "Food Servers", category: "Food & Beverage / Hospitality" },
    { title: "Brand Ambassadors", category: "Promotions & Events" },
  ];

  return (
    <section id="specializations" className="py-16 sm:py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-mono font-bold uppercase tracking-wider mb-3">
            Roles & Positions
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
            Job Specializations
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            We source and deploy trained talent across critical blue-collar, technical, and commercial roles.
          </p>
        </div>

        {/* Clean Grid with glide hover */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {specializations.map((item, idx) => (
            <div
              key={idx}
              className="p-4 bg-slate-50 border border-slate-200 flex items-start gap-3 hover:border-slate-300 glide-hover"
            >
              <CheckCircle className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold font-mono uppercase text-slate-900 leading-tight">
                  {item.title}
                </h3>
                <span className="text-[11px] text-slate-500 font-sans block mt-1">
                  {item.category}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Note / Callout */}
        <div className="mt-8 p-4 bg-slate-100 border-l-4 border-teal-700 text-xs text-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono">
          <span>Need specialized workforce requirements not listed above?</span>
          <a
            href="#contact"
            onClick={(e) => scrollToSection(e, "#contact")}
            className="text-teal-800 font-bold uppercase hover:underline shrink-0 cursor-pointer"
          >
            Inquire for Custom Roles →
          </a>
        </div>

      </div>
    </section>
  );
};
