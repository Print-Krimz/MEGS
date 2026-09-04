import React from "react";
import { Link } from "@tanstack/react-router";
import {
  Factory,
  Truck,
  Wrench,
  Cpu,
  Calculator,
  Building,
  ArrowRight,
} from "lucide-react";

interface CategoryItem {
  name: string;
  count: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const CATEGORIES: CategoryItem[] = [
  {
    name: "Manufacturing & Production",
    count: "40+ Roles",
    icon: Factory,
    description: "Packaging operators, machine tenders, QA inspectors, and plant supervisors.",
  },
  {
    name: "Logistics & Warehousing",
    count: "35+ Roles",
    icon: Truck,
    description: "Forklift operators, inventory clerks, dispatchers, and warehouse leads.",
  },
  {
    name: "Technical & Engineering",
    count: "28+ Roles",
    icon: Wrench,
    description: "Electricians, mechanics, facility engineers, and automation technicians.",
  },
  {
    name: "Information Technology",
    count: "20+ Roles",
    icon: Cpu,
    description: "Frontend & backend developers, systems analysts, and technical support.",
  },
  {
    name: "Accounting & Finance",
    count: "15+ Roles",
    icon: Calculator,
    description: "Bookkeepers, billing specialists, payroll analysts, and auditors.",
  },
  {
    name: "Administrative & Office",
    count: "25+ Roles",
    icon: Building,
    description: "Executive assistants, data encoders, HR staff, and customer service reps.",
  },
];

export const LandingCategories: React.FC = () => {
  return (
    <section id="categories" className="py-16 sm:py-20 bg-white border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
            Browse by Career Category
          </h2>
          <p className="text-sm text-slate-600">
            Find opportunities matched to your specialized skills and professional experience.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.name}
                to="/app/jobs"
                search={{ search: cat.name } as any}
                className="p-5 rounded-2xl border border-slate-200/90 hover:border-blue-300 hover:shadow-md bg-white transition-all duration-200 flex flex-col justify-between space-y-3 group text-left cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>

                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                    {cat.count}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {cat.description}
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                  <span>View jobs</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};
