import React from "react";
import { 
  CheckCircle2, 
  Layers, 
  Boxes, 
  ShoppingBag, 
  Utensils, 
  FileSpreadsheet,
  ArrowRight
} from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";

export const LandingSpecializations: React.FC = () => {
  const domains = [
    {
      domain: "Industrial & Manufacturing",
      icon: Layers,
      roles: [
        { title: "Production Supervisor / Worker", detail: "Assembly lines, packing, food manufacturing, plant processing" },
        { title: "Machine Operators", detail: "Industrial machinery, press operation, packaging systems, equipment calibration" },
        { title: "Welders (SMAW / GMAW / TIG)", detail: "Structural welding, metal fabrication, industrial maintenance" },
        { title: "Utility Helpers", detail: "Plant maintenance, facility cleaning, line assist, material movement" },
      ],
    },
    {
      domain: "Logistics & Warehousing",
      icon: Boxes,
      roles: [
        { title: "Warehouse Crew", detail: "Receiving, sorting, picking, palletizing, order fulfillment" },
        { title: "Forklift Operators", detail: "TESDA-certified reach truck & counter-balance forklift maneuvering" },
        { title: "Delivery Drivers", detail: "Professional 4-wheeler to 6-wheeler distribution & cargo logistics" },
        { title: "Messengers (Motorized / Foot)", detail: "Corporate document transit, banking tasks, urgent field courier dispatch" },
      ],
    },
    {
      domain: "Retail & Field Marketing",
      icon: ShoppingBag,
      roles: [
        { title: "Sales Promo / Merchandisers", detail: "Department stores, supermarkets, planogram maintenance, inventory display" },
        { title: "Cashiers / Baggers", detail: "POS handling, accurate cash transactions, rapid retail packing" },
        { title: "Brand Ambassadors", detail: "Product activations, trade shows, field demonstrations, sampling campaigns" },
      ],
    },
    {
      domain: "Administrative & Operations Support",
      icon: FileSpreadsheet,
      roles: [
        { title: "Office Staff / Clerks", detail: "Administrative documentation, reception, scheduling, filing, correspondence" },
        { title: "Data Encoders", detail: "High-speed data entry, database verification, billing entry, records digitization" },
        { title: "QA / QC Personnel", detail: "Raw material inspection, finished goods testing, compliance verification" },
      ],
    },
    {
      domain: "Hospitality & Food Service",
      icon: Utensils,
      roles: [
        { title: "Food Servers & Dining Crew", detail: "Table service, banquet setup, customer assistance, cafeteria operations" },
      ],
    },
  ];

  return (
    <section id="specializations" className="py-16 sm:py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-mono font-bold uppercase tracking-wider mb-3">
            Roles & Positions
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
            Job Specializations Directory
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            We source, screen, verify, and deploy trained personnel across 15 core technical, commercial, and operational job specializations.
          </p>
        </div>

        {/* Specialization Domains Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {domains.map((dom, idx) => {
            const Icon = dom.icon;
            return (
              <div
                key={idx}
                className="bg-slate-50 border border-slate-200 rounded-xl p-6 sm:p-7 flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                    <div className="w-10 h-10 rounded-lg bg-teal-800 text-white flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-teal-100" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold font-mono uppercase text-slate-900 tracking-tight">
                        {dom.domain}
                      </h3>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {dom.roles.length} {dom.roles.length === 1 ? "Role" : "Roles"}
                      </span>
                    </div>
                  </div>

                  {/* Roles List */}
                  <div className="space-y-4">
                    {dom.roles.map((role, rIdx) => (
                      <div key={rIdx} className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-1" />
                        <div>
                          <h4 className="text-xs font-bold font-mono text-slate-900 uppercase">
                            {role.title}
                          </h4>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed font-sans">
                            {role.detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom Workforce Callout */}
        <div className="mt-12 p-6 sm:p-8 bg-slate-900 text-white rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-teal-400 block mb-1">
              Custom Talent Requirements
            </span>
            <p className="text-sm text-slate-300 max-w-2xl font-sans">
              Need specialized or high-volume workforce requirements not listed above? MEGS coordinates dedicated custom recruitment campaigns tailored to your specific facility or project.
            </p>
          </div>
          <a
            href="#contact"
            onClick={(e) => scrollToSection(e, "#contact")}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-600 text-white text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            <span>Inquire for Custom Roles</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>

      </div>
    </section>
  );
};
