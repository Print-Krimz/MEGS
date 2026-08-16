import React from "react";
import { Factory, Truck, Warehouse, ShoppingBag, Utensils } from "lucide-react";

export const LandingIndustries: React.FC = () => {
  const industries = [
    {
      icon: Factory,
      name: "Manufacturing",
      description: "Electronics, food processing, packaging, assembly lines, and general industrial plants.",
    },
    {
      icon: Truck,
      name: "Logistics",
      description: "Freight forwarding, delivery fleets, transport operations, and distribution hubs.",
    },
    {
      icon: Warehouse,
      name: "Warehousing",
      description: "Inventory management, sorting, forklift handling, and supply chain storage centers.",
    },
    {
      icon: ShoppingBag,
      name: "Retail / Sales / Distribution",
      description: "Supermarkets, department stores, brand merchandising, and commercial distribution.",
    },
    {
      icon: Utensils,
      name: "Hotel & Restaurant",
      description: "Hospitality staffing, dining service, food preparation, and banquet crew.",
    },
  ];

  return (
    <section id="industries" className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-mono font-bold uppercase tracking-wider mb-3">
            Sectors We Support
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
            Industries We Serve
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Providing tailored manpower pipelines designed around the unique compliance and productivity requirements of key Philippine industries.
          </p>
        </div>

        {/* 5 Industries Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {industries.map((ind, idx) => {
            const Icon = ind.icon;
            return (
              <div
                key={idx}
                className="bg-white border border-slate-200 p-6 flex flex-col justify-between hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="w-10 h-10 bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-slate-800" />
                  </div>
                  <h3 className="text-base font-bold font-mono uppercase text-slate-900 tracking-tight mb-2">
                    {ind.name}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {ind.description}
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
