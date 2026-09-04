import React, { useState } from "react";
import { 
  MapPin, 
  Building2, 
  Phone, 
  ExternalLink, 
  Copy, 
  Check, 
  Compass, 
  ShieldCheck 
} from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";

interface Branch {
  id: string;
  name: string;
  region: "Luzon & NCR" | "Visayas" | "Mindanao";
  isHQ: boolean;
  address: string;
  landmark?: string;
  phone: string;
  mobile: string;
  coords: { x: number; y: number }; // Percentage on calibrated map (0-100)
  focus: string;
}

export const LandingBranches: React.FC = () => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>("valenzuela");
  const [regionFilter, setRegionFilter] = useState<"ALL" | "Luzon & NCR" | "Visayas" | "Mindanao">("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const branches: Branch[] = [
    {
      id: "valenzuela",
      name: "Valenzuela Central Office",
      region: "Luzon & NCR",
      isHQ: true,
      address: "#9, PJAR Bldg, P. Gomez St, Malinta, Valenzuela City",
      landmark: "Central Operations & Executive Headquarters",
      phone: "(02) 8292-1234",
      mobile: "0917-629-1864 (Globe)",
      coords: { x: 39, y: 34 },
      focus: "Executive Administration, National Deployment Hub, PJAR Group HQ",
    },
    {
      id: "quezon-city",
      name: "Quezon City Branch",
      region: "Luzon & NCR",
      isHQ: false,
      address: "Rm 207, 2nd Floor, STG Bldg., 109 P. Tuazon, Cubao, Quezon City",
      landmark: "Recruitment & Applicant Interview Center",
      phone: "(02) 8911-5678",
      mobile: "0917-629-1864 (Globe)",
      coords: { x: 43, y: 36.5 },
      focus: "High-volume recruitment, candidate screening, Metro Manila placement",
    },
    {
      id: "binan",
      name: "Biñan, Laguna Branch",
      region: "Luzon & NCR",
      isHQ: false,
      address: "3rd Fl, Uniworld Bldg. 347, Burgos St., Brgy Vicente, Biñan, Laguna",
      landmark: "Southern Luzon Industrial Workforce Hub",
      phone: "(049) 511-2345",
      mobile: "0917-629-1864 (Globe)",
      coords: { x: 42, y: 42.5 },
      focus: "Technopark deployment, electronics manufacturing, logistics parks",
    },
    {
      id: "batangas",
      name: "Tanauan, Batangas Branch",
      region: "Luzon & NCR",
      isHQ: false,
      address: "PJAR Trading, (In front of New City Hall), Brgy Santor, Tanauan City, Batangas",
      landmark: "CALABARZON Industrial Corridor Hub",
      phone: "(043) 778-9012",
      mobile: "0917-629-1864 (Globe)",
      coords: { x: 40.5, y: 47 },
      focus: "Industrial fabrication, assembly plants, agro-industrial staffing",
    },
    {
      id: "cebu",
      name: "Cebu Branch",
      region: "Visayas",
      isHQ: false,
      address: "RM 301, Du Sui Bldg, North Road, Brgy Jagobiao, Mandaue City, Cebu",
      landmark: "Central Visayas Regional Center",
      phone: "(032) 345-6789",
      mobile: "0923-745-4050 (Sun/Smart)",
      coords: { x: 61, y: 64 },
      focus: "Central Visayas commercial operations, hospitality, logistics hubs",
    },
    {
      id: "davao",
      name: "Davao City Branch",
      region: "Mindanao",
      isHQ: false,
      address: "D2 2F, C LAT Bldg, Bonifacio St, Davao City",
      landmark: "Southern Mindanao Operations Hub",
      phone: "(082) 221-3456",
      mobile: "0923-745-4050 (Sun/Smart)",
      coords: { x: 74, y: 88 },
      focus: "Southern Mindanao industrial staffing, warehousing, distribution",
    },
  ];

  const filteredBranches = regionFilter === "ALL" 
    ? branches 
    : branches.filter((b) => b.region === regionFilter);

  const selectedBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];

  const handleCopyAddress = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <section id="branches" className="py-16 sm:py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-16 gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-mono font-bold uppercase tracking-wider mb-3">
              Nationwide Service Network
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
              6 Strategic Branch Offices Across the Philippines
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
              Unlike single-office agencies, MEGS operates 6 dedicated branches across Luzon, Visayas, and Mindanao. This allows us to mobilize trained local talent immediately, support national corporate expansions, and maintain responsive on-site management.
            </p>
          </div>

          {/* Region Tabs */}
          <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 rounded-lg border border-slate-200 shrink-0">
            {(["ALL", "Luzon & NCR", "Visayas", "Mindanao"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRegionFilter(r)}
                className={`px-3 py-1.5 text-xs font-mono font-bold uppercase rounded-md transition-all cursor-pointer ${
                  regionFilter === r
                    ? "bg-[#0f294a] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                {r === "ALL" ? "All (6)" : r}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Map & Branch Selector Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Interactive Philippine Map Display */}
          <div className="lg:col-span-6 xl:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-between text-white relative overflow-hidden shadow-lg">
            
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-30 pointer-events-none" />

            {/* Map Header Status */}
            <div className="w-full flex items-center justify-between mb-4 z-10">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-teal-400 animate-spin-slow" />
                <span className="text-[11px] font-mono font-bold text-teal-400 uppercase tracking-wider">
                  Philippine Archipelago
                </span>
              </div>
              <span className="px-2.5 py-0.5 bg-teal-950/80 border border-teal-600/40 text-teal-300 text-[10px] font-mono font-bold rounded">
                Active Branch: {selectedBranch.name.split(" ")[0]}
              </span>
            </div>

            {/* Calibrated Philippine Archipelago Map & Interactive Markers */}
            <div className="relative w-full max-w-[340px] sm:max-w-[400px] aspect-[3/4] flex items-center justify-center z-10 my-2">
              
              {/* Canva Philippine Map Silhouette */}
              <img
                src="/images/canva-ref/map-philippines.png"
                alt="Map of the Philippines with MEGS Branch Locations"
                className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(20,184,166,0.25)] brightness-95"
              />

              {/* Interactive SVG Hotspots */}
              {branches.map((b) => {
                const isSelected = selectedBranchId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBranchId(b.id)}
                    aria-label={`Select ${b.name}`}
                    style={{ left: `${b.coords.x}%`, top: `${b.coords.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer focus:outline-hidden"
                  >
                    {/* Pulsing Target Ring */}
                    <span
                      className={`absolute -inset-2 rounded-full transition-opacity duration-300 ${
                        isSelected
                          ? "bg-teal-400/40 animate-ping"
                          : "bg-teal-500/0 group-hover:bg-teal-400/20"
                      }`}
                    />

                    {/* Marker Dot */}
                    <div
                      className={`relative flex items-center justify-center rounded-full border-2 transition-all duration-200 ${
                        isSelected
                          ? "w-6 h-6 bg-teal-400 border-white shadow-[0_0_12px_#2dd4bf]"
                          : "w-4 h-4 bg-teal-700 border-slate-900 group-hover:bg-teal-400 group-hover:scale-125"
                      }`}
                    >
                      <MapPin
                        className={`transition-all ${
                          isSelected ? "w-3.5 h-3.5 text-slate-950" : "w-2.5 h-2.5 text-white"
                        }`}
                      />
                    </div>

                    {/* Tooltip on Hover */}
                    <div
                      className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-[10px] font-mono text-white whitespace-nowrap pointer-events-none transition-opacity duration-150 shadow-md ${
                        isSelected ? "opacity-100 z-20" : "opacity-0 group-hover:opacity-100 z-10"
                      }`}
                    >
                      {b.name}
                      {b.isHQ && " (HQ)"}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Map Legend */}
            <div className="w-full pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400 z-10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block shadow-[0_0_6px_#2dd4bf]" />
                <span>MEGS Branch Location</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-teal-900 text-teal-300 font-bold rounded text-[9px]">
                  HQ
                </span>
                <span>Central Office</span>
              </div>
            </div>

          </div>

          {/* Right: Branch Details & Switcher Cards */}
          <div className="lg:col-span-6 xl:col-span-7 space-y-4">
            
            {/* Active Highlight Banner */}
            <div className="p-6 bg-teal-50 border-2 border-teal-700/60 rounded-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-teal-800 text-white text-[10px] font-mono font-bold uppercase rounded">
                    {selectedBranch.region}
                  </span>
                  {selectedBranch.isHQ && (
                    <span className="px-2.5 py-0.5 bg-slate-900 text-teal-300 text-[10px] font-mono font-bold uppercase rounded border border-slate-800">
                      National Central Headquarters
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyAddress(selectedBranch.id, selectedBranch.address)}
                  className="inline-flex items-center gap-1 text-xs font-mono font-bold text-teal-900 hover:text-teal-700 cursor-pointer"
                >
                  {copiedId === selectedBranch.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-teal-800" />
                      <span>Address Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Address</span>
                    </>
                  )}
                </button>
              </div>

              <h3 className="text-xl font-bold font-mono text-slate-900 uppercase tracking-tight">
                {selectedBranch.name}
              </h3>
              
              <p className="text-xs sm:text-sm text-slate-700 mt-2 font-medium leading-relaxed">
                {selectedBranch.address}
              </p>

              {selectedBranch.landmark && (
                <p className="text-xs text-teal-800 font-mono mt-1 font-semibold">
                  📌 {selectedBranch.landmark}
                </p>
              )}

              <div className="mt-4 pt-4 border-t border-teal-200/80 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
                <div className="flex items-center gap-3">
                  <Phone className="w-3.5 h-3.5 text-teal-800" />
                  <span className="text-slate-800 font-bold">{selectedBranch.mobile}</span>
                </div>
                <a
                  href="#contact"
                  onClick={(e) => scrollToSection(e, "#contact")}
                  className="text-teal-900 font-bold uppercase hover:underline cursor-pointer"
                >
                  Direct Branch Inquiries →
                </a>
              </div>
            </div>

            {/* List of All Branches */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {filteredBranches.map((branch) => {
                const isActive = branch.id === selectedBranchId;
                return (
                  <div
                    key={branch.id}
                    onClick={() => setSelectedBranchId(branch.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${
                      isActive
                        ? "bg-[#0f294a] text-white border-[#0f294a] shadow-sm"
                        : "bg-white text-slate-900 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-[10px] font-mono uppercase tracking-wider font-bold ${
                          isActive ? "text-teal-300" : "text-teal-800"
                        }`}
                      >
                        {branch.region}
                      </span>
                      {branch.isHQ && (
                        <span
                          className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                            isActive ? "bg-teal-800 text-white" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          HQ
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs sm:text-sm font-bold font-mono uppercase tracking-tight">
                      {branch.name}
                    </h4>

                    <p
                      className={`text-[11px] mt-1 line-clamp-2 leading-relaxed ${
                        isActive ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      {branch.address}
                    </p>
                  </div>
                );
              })}
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
