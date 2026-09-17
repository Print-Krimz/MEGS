import React, { useState } from "react";
import { Search, MapPin } from "lucide-react";
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
    <section className="bg-[#071322] text-white border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        
        {/* Main Value Proposition */}
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <p className="text-xs sm:text-sm font-mono uppercase tracking-wider text-blue-300 font-semibold">
            Serving Top 1,000 Corporations Since May 1997
          </p>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight font-sans">
            Better People for Better Results.
          </h1>

          <p className="text-sm sm:text-base lg:text-lg text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed font-sans">
            Premier Philippine manpower & human resource provider. Supplying DOLE D.O. 40-compliant workforce management, rapid site deployment, and insured personnel across 6 nationwide branches.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href="#jobs"
              onClick={(e) => scrollToSection(e, "#jobs")}
              className="px-6 py-3 bg-[#0f294a] hover:bg-[#163b66] border border-blue-500/50 text-white text-xs sm:text-sm font-mono font-bold uppercase tracking-wider rounded-lg transition-colors inline-flex items-center justify-center cursor-pointer shadow-xs"
            >
              <span>Explore Open Roles</span>
            </a>

            <a
              href="#contact"
              onClick={(e) => scrollToSection(e, "#contact")}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs sm:text-sm font-mono font-bold uppercase tracking-wider rounded-lg transition-colors inline-flex items-center justify-center cursor-pointer shadow-xs"
            >
              <span>Request Manpower Proposal</span>
            </a>
          </div>
        </div>

        {/* Job Search Form */}
        <div className="max-w-4xl mx-auto mt-10 sm:mt-12">
          <form
            onSubmit={handleSubmit}
            className="bg-white p-2.5 rounded-xl border border-slate-300 shadow-md text-slate-900"
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
                  className="w-full pl-10 pr-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0f294a] rounded-lg"
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
                  placeholder="Branch or City (e.g. Valenzuela, Cebu)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0f294a] rounded-lg"
                />
              </div>

              {/* Submit */}
              <div className="sm:col-span-3 sm:pl-1 flex items-center">
                <button
                  type="submit"
                  className="w-full bg-[#0f294a] hover:bg-[#163b66] text-white text-xs sm:text-sm font-bold font-mono uppercase py-3 px-4 rounded-lg transition-colors border border-[#0f294a] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Search className="w-4 h-4" aria-hidden="true" />
                  <span>Search Jobs</span>
                </button>
              </div>
            </div>
          </form>

          {/* Quick Filter Links */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-300">
            <span className="font-mono text-slate-400 text-xs">Popular specializations:</span>
            {POPULAR_SEARCHES.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagClick(tag)}
                className="text-xs text-slate-300 hover:text-white underline underline-offset-2 hover:no-underline px-1 py-0.5 cursor-pointer font-sans"
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Key Facts Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-8 pt-8 border-t border-slate-800 text-center">
            <div>
              <span className="text-xl sm:text-2xl font-bold font-mono text-white">27+ Years</span>
              <p className="text-xs text-slate-400 font-sans mt-0.5">Established May 1997</p>
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-bold font-mono text-white">6 Branches</span>
              <p className="text-xs text-slate-400 font-sans mt-0.5">Luzon · Visayas · Mindanao</p>
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-bold font-mono text-white">DOLE D.O. 40</span>
              <p className="text-xs text-slate-400 font-sans mt-0.5">Zero Joint Liability</p>
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-bold font-mono text-white">PALSCON</span>
              <p className="text-xs text-slate-400 font-sans mt-0.5">Accredited Member</p>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
