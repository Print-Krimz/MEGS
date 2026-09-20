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

  const scrollToJobsResults = () => {
    const jobsEl = document.getElementById("jobs");
    if (jobsEl && typeof jobsEl.scrollIntoView === "function") {
      jobsEl.scrollIntoView({ behavior: "smooth" });
    }
    // Move keyboard focus to the results heading so the search outcome is announced.
    window.setTimeout(() => {
      document.getElementById("jobs-heading")?.focus({ preventScroll: true });
    }, 450);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch({ search: keyword.trim(), location: location.trim() });
    }
    scrollToJobsResults();
  };

  const handleTagClick = (tag: string) => {
    setKeyword(tag);
    if (onSearch) {
      onSearch({ search: tag, location: location.trim() });
    }
    scrollToJobsResults();
  };

  return (
    <section className="bg-[#071322] text-white border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        
        {/* Main Value Proposition */}
        <div className="max-w-3xl mx-auto text-center space-y-5">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.14em] text-blue-300">
            Serving Top 1,000 Corporations Since May 1997
          </p>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08] text-balance">
            Better People for Better Results.
          </h1>

          <p className="text-sm sm:text-base lg:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Premier Philippine manpower & human resource provider. Supplying DOLE D.O. 40-compliant workforce management, rapid site deployment, and insured personnel across 6 nationwide branches.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
            <a
              href="#jobs"
              onClick={(e) => scrollToSection(e, "#jobs")}
              className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-blue-50 text-[#0f294a] text-sm font-bold rounded-lg transition-colors inline-flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#071322]"
            >
              <span>Explore Open Roles</span>
            </a>

            <a
              href="#contact"
              onClick={(e) => scrollToSection(e, "#contact")}
              className="w-full sm:w-auto px-7 py-3.5 bg-transparent hover:bg-white/10 text-white border border-white/25 text-sm font-semibold rounded-lg transition-colors inline-flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#071322]"
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
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
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
                  className="w-full pl-10 pr-3 py-3 text-sm text-slate-900 placeholder-slate-500 bg-transparent focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0f294a] rounded-lg"
                />
              </div>

              {/* Location Input */}
              <div className="sm:col-span-4 relative flex items-center sm:border-l sm:border-slate-200 sm:pl-2">
                <MapPin className="w-5 h-5 text-slate-400 absolute left-3 sm:left-5 pointer-events-none shrink-0" aria-hidden="true" />
                <input
                  type="text"
                  id="hero-job-location"
                  aria-label="Location"
                  placeholder="Branch or City (e.g. Valenzuela, Cebu)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 text-sm text-slate-900 placeholder-slate-500 bg-transparent focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0f294a] rounded-lg"
                />
              </div>

              {/* Submit */}
              <div className="sm:col-span-3 flex items-center">
                <button
                  type="submit"
                  className="w-full bg-[#0f294a] hover:bg-[#163b66] text-white text-sm font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f294a] focus-visible:ring-offset-2 min-h-[44px]"
                >
                  <Search className="w-4 h-4" aria-hidden="true" />
                  <span>Search Jobs</span>
                </button>
              </div>
            </div>
          </form>

          {/* Quick Filter Links */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-slate-300">
            <span className="text-slate-400 text-xs">Popular specializations:</span>
            {POPULAR_SEARCHES.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagClick(tag)}
                className="text-xs text-slate-300 hover:text-white underline underline-offset-4 decoration-slate-600 hover:decoration-white px-1 py-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Key Facts Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-8 pt-8 border-t border-slate-800 text-center">
            <div>
              <span className="text-xl sm:text-2xl font-extrabold text-white">27+ Years</span>
              <p className="text-xs text-slate-400 mt-1">Established May 1997</p>
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-extrabold text-white">6 Branches</span>
              <p className="text-xs text-slate-400 mt-1">Luzon · Visayas · Mindanao</p>
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-extrabold text-white">DOLE D.O. 40</span>
              <p className="text-xs text-slate-400 mt-1">Zero Joint Liability</p>
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-extrabold text-white">PALSCON</span>
              <p className="text-xs text-slate-400 mt-1">Accredited Member</p>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
