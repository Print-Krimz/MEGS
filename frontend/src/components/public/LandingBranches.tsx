import React from "react";
import { MapPin, Building, PhoneCall } from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";

export const LandingBranches: React.FC = () => {
  const branches = [
    {
      region: "Central & National Capital Region",
      location: "Valenzuela City",
      type: "Central Office / Main Operations",
      highlight: true,
    },
    {
      region: "National Capital Region",
      location: "Quezon City Branch",
      type: "Operations & Recruitment Center",
      highlight: false,
    },
    {
      region: "Southern Luzon / CALABARZON",
      location: "Biñan, Laguna Branch",
      type: "Industrial Workforce Deployment Hub",
      highlight: false,
    },
    {
      region: "Southern Luzon / CALABARZON",
      location: "Tanauan, Batangas Branch",
      type: "Industrial Corridor Operations",
      highlight: false,
    },
    {
      region: "Visayas",
      location: "Cebu Branch",
      type: "Central Visayas Regional Center",
      highlight: false,
    },
    {
      region: "Mindanao",
      location: "Davao Branch",
      type: "Southern Mindanao Operations Hub",
      highlight: false,
    },
  ];

  return (
    <section id="branches" className="py-16 sm:py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-mono font-bold uppercase tracking-wider mb-3">
            Service Network
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
            Nationwide Presence
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            With key branch offices strategically located near major industrial zones and commercial hubs across Luzon, Visayas, and Mindanao.
          </p>
        </div>

        {/* Branches Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((branch, idx) => (
            <div
              key={idx}
              className={`p-6 border transition-all glide-hover ${
                branch.highlight
                  ? "bg-slate-900 text-white border-slate-800"
                  : "bg-slate-50 text-slate-900 border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin
                    className={`w-4 h-4 ${
                      branch.highlight ? "text-teal-400" : "text-teal-700"
                    }`}
                  />
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider ${
                      branch.highlight ? "text-teal-300" : "text-slate-500"
                    }`}
                  >
                    {branch.region}
                  </span>
                </div>
                {branch.highlight && (
                  <span className="px-2 py-0.5 bg-teal-800 text-white text-[9px] font-mono font-bold uppercase border border-teal-700">
                    HQ
                  </span>
                )}
              </div>

              <h3 className="text-base font-bold font-mono uppercase tracking-tight mb-1">
                {branch.location}
              </h3>
              <p
                className={`text-xs ${
                  branch.highlight ? "text-slate-300" : "text-slate-600"
                }`}
              >
                {branch.type}
              </p>
            </div>
          ))}
        </div>

        {/* Coordination Footer */}
        <div className="mt-8 p-4 bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono text-slate-700">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-slate-500" />
            <span>Coordinated nationwide recruitment & immediate site deployment.</span>
          </div>
          <a
            href="#contact"
            onClick={(e) => scrollToSection(e, "#contact")}
            className="inline-flex items-center gap-1.5 text-teal-800 font-bold uppercase hover:underline shrink-0 cursor-pointer"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Contact Local Branch</span>
          </a>
        </div>

      </div>
    </section>
  );
};
