import React, { useState } from "react";
import { Search, MapPin, ArrowDown, Briefcase, ShieldCheck } from "lucide-react";
import { scrollToSection } from "../../lib/scrollToSection";

export interface LandingHeroProps {
  onSearch?: (filters: { search: string; location: string }) => void;
  initialSearch?: string;
  initialLocation?: string;
}

const POPULAR_SEARCHES = [
  "Production Worker",
  "Forklift Operator",
  "Warehouse Crew",
  "QA/QC Personnel",
  "Delivery Driver",
  "Sales Promo",
  "Machine Operator",
];

export const LandingHero: React.FC<LandingHeroProps> = ({
  onSearch,
  initialSearch = "",
  initialLocation = "",
}) => {
  const [keyword, setKeyword] = useState(initialSearch);
  const [location, setLocation] = useState(initialLocation);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch({ search: keyword.trim(), location: location.trim() });
    }
    const jobsEl = document.getElementById("jobs");
    if (jobsEl && typeof jobsEl.scrollIntoView === "function") {
      jobsEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleTagClick = (tag: string) => {
    setKeyword(tag);
    if (onSearch) {
      onSearch({ search: tag, location: location.trim() });
    }
    const jobsEl = document.getElementById("jobs");
    if (jobsEl && typeof jobsEl.scrollIntoView === "function") {
      jobsEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative bg-[#071322] text-white border-b border-slate-800 overflow-hidden">
      
      {/* Background Graphic Accents */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none"
        style={{ backgroundImage: "url('/images/canva-ref/makati-skyline.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#071322]/80 via-[#071322]/95 to-[#071322] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-28">
        
        {/* Top Eyebrow & Badges */}
        <div className="max-w-3xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-950/80 border border-teal-500/40 rounded-full text-teal-300 text-xs font-mono font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>Serving Top 1,000 Corporations Since May 1997</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight font-sans">
            Better People for <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-teal-100">
              Better Results.
            </span>
          </h1>

          <p className="text-sm sm:text-base lg:text-lg text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Premier Philippine manpower & human resource provider. Supplying DOLE D.O. 40-compliant workforce management, rapid site deployment, and insured personnel across 6 nationwide branches.
          </p>

          {/* Dual Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href="#jobs"
              onClick={(e) => scrollToSection(e, "#jobs")}
              className="px-6 py-3.5 bg-teal-600 hover:bg-teal-500 text-white text-xs sm:text-sm font-mono font-bold uppercase tracking-wider rounded-lg transition-all shadow-sm flex items-center gap-2 cursor-pointer hover:-translate-y-0.5"
            >
              <Briefcase className="w-4 h-4" />
              <span>Explore Open Roles</span>
            </a>

            <a
              href="#contact"
              onClick={(e) => scrollToSection(e, "#contact")}
              className="px-6 py-3.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs sm:text-sm font-mono font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <ArrowDown className="w-4 h-4 text-teal-400" />
              <span>Request Manpower Proposal</span>
            </a>
          </div>
        </div>

        {/* Live Applicant Search Bar */}
        <div className="max-w-4xl mx-auto mt-10 sm:mt-14">
          <form
            onSubmit={handleSubmit}
            className="bg-white p-2.5 rounded-2xl border border-slate-300/80 shadow-2xl text-slate-900"
            role="search"
            aria-label="Job Search"
          >
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              {/* Keyword Input */}
              <div className="sm:col-span-5 relative flex items-center">
                <Search className="w-5 h-5 text-slate-400 absolute left-3 pointer-events-none shrink-0" aria-hidden="true" />
                <input
                  type="text"
                  id="hero-job-keyword"
                  aria-label="Job title or keyword"
                  placeholder="Role, skill, or specialization (e.g. Forklift)"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0f294a] rounded-lg"
                />
              </div>

              {/* Divider */}
              <div className="hidden sm:block w-px bg-slate-200 self-stretch my-1" aria-hidden="true" />

              {/* Location Input */}
              <div className="sm:col-span-4 relative flex items-center">
                <MapPin className="w-5 h-5 text-slate-400 absolute left-3 pointer-events-none shrink-0" aria-hidden="true" />
                <input
                  type="text"
                  id="hero-job-location"
                  aria-label="Location"
                  placeholder="Branch / City (e.g. Valenzuela, Cebu)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0f294a] rounded-lg"
                />
              </div>

              {/* Search Submit */}
              <div className="sm:col-span-3 sm:pl-1 flex items-center">
                <button
                  type="submit"
                  className="w-full bg-[#0f294a] hover:bg-[#163b66] text-white text-xs sm:text-sm font-bold font-mono uppercase py-3.5 px-4 rounded-lg transition-colors border border-[#0f294a] flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Search className="w-4 h-4" aria-hidden="true" />
                  <span>Search Jobs</span>
                </button>
              </div>
            </div>
          </form>

          {/* Popular Search Tags */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-300">
            <span className="font-semibold text-slate-400 font-mono text-[11px]">Popular specializations:</span>
            {POPULAR_SEARCHES.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagClick(tag)}
                className="px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 hover:text-white transition-colors border border-slate-700/60 cursor-pointer font-sans"
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-8 border-t border-slate-800/80 text-center">
            <div>
              <span className="text-xl sm:text-2xl font-black font-mono text-teal-300">27+ Years</span>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5 uppercase">Established May 1997</p>
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-black font-mono text-teal-300">6 Branches</span>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5 uppercase">Luzon · Visayas · Mindanao</p>
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-black font-mono text-teal-300">DOLE D.O. 40</span>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5 uppercase">Zero Joint Liability</p>
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-black font-mono text-teal-300">PALSCON</span>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5 uppercase">Accredited Member</p>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
