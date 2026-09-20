import React from "react";
import { ArrowUpRight } from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";

export const LandingIndustries: React.FC = () => {
  const industries = [
    {
      id: "manufacturing",
      name: "Manufacturing",
      image: "/images/canva-ref/industries/manufacturing.jpg",
      description:
        "Electronics assembly, food processing lines, plastic extrusion, packaging operations, and precision machinery plants across economic zones.",
      roles: ["Machine Operators", "Assembly Crew", "QA/QC Personnel", "Production Supervisors"],
    },
    {
      id: "logistics",
      name: "Logistics & Transport",
      image: "/images/canva-ref/industries/logistics.jpg",
      description:
        "Multi-modal freight forwarding, delivery fleet operations, courier transport, route planning, and national supply chain dispatching.",
      roles: ["Delivery Drivers", "Messengers", "Fleet Dispatchers", "Logistics Clerks"],
    },
    {
      id: "warehousing",
      name: "Warehousing & Storage",
      image: "/images/canva-ref/industries/warehousing.jpg",
      description:
        "High-density distribution centers, inventory scanning, goods receiving, palletizing, order sorting, and industrial forklift maneuvers.",
      roles: ["Forklift Operators", "Warehouse Crew", "Material Handlers", "Inventory Encoders"],
    },
    {
      id: "retail",
      name: "Retail, Sales & Distribution",
      image: "/images/canva-ref/industries/retail.jpg",
      description:
        "Hypermarkets, department stores, retail chains, and fast-moving consumer goods (FMCG) distribution networks nationwide.",
      roles: ["Sales Promo / Merchandisers", "Cashiers & Baggers", "Brand Ambassadors", "Stock Clerks"],
    },
    {
      id: "hospitality",
      name: "Hotel & Restaurant",
      image: "/images/canva-ref/industries/hospitality.jpg",
      description:
        "Premier hotels, restaurant chains, catering services, banquet halls, institutional cafeterias, and hospitality dining floors.",
      roles: ["Food Servers", "Kitchen Helpers", "Dining Stewards", "Banquet Crew"],
    },
    {
      id: "gaming",
      name: "Gaming & Casino",
      image: "/images/canva-ref/industries/casino.jpg",
      description:
        "Integrated resort gaming facilities, entertainment complexes, high-volume recreation centers, and guest operations support.",
      roles: ["Floor Attendants", "Cashier Personnel", "Utility Helpers", "Front-Line Support"],
    },
  ];

  return (
    <section id="industries" className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-10 gap-6">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
              Specialized Industry Sectors
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0f294a] tracking-tight">
              Partner Industries We Support
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
              We deploy vetted, disciplined manpower tailored to the operational workflows, safety standards, and compliance regulations of 6 key Philippine industries.
            </p>
          </div>

          <a
            href="#contact"
            onClick={(e) => scrollToSection(e, "#contact")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0f294a] hover:text-blue-700 transition-colors shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f294a] rounded py-1"
          >
            <span>Inquire for Your Industry</span>
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>

        {/* 6 Industry Photo Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {industries.map((ind) => {
            return (
              <div
                key={ind.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between hover:border-slate-300 shadow-2xs transition-all duration-200 group"
              >
                {/* Photo */}
                <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                  <img
                    src={ind.image}
                    alt={`${ind.name} workforce`}
                    className="w-full h-full object-cover opacity-95 group-hover:scale-102 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>

                {/* Content */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="mb-3">
                      <h3 className="text-base font-bold text-[#0f294a] tracking-tight">
                        {ind.name}
                      </h3>
                    </div>

                    <p className="text-sm text-slate-600 leading-relaxed mb-4">
                      {ind.description}
                    </p>
                  </div>

                  {/* Supplied Roles (Clean inline list instead of decorative sticker pills) */}
                  <div className="pt-4 border-t border-slate-100">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 block mb-1.5">
                      Key Personnel Supplied
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {ind.roles.join(" • ")}
                    </p>
                  </div>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
