import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, MapPin, ArrowRight } from "lucide-react";

export interface HeroSearchProps {
  initialSearch?: string;
  initialLocation?: string;
  className?: string;
  onSearch?: (search: string, location: string) => void;
  targetPath?: string;
}

const POPULAR_TAGS = [
  "Warehouse Supervisor",
  "Industrial Electrician",
  "Logistics Coordinator",
  "Administrative Assistant",
  "Forklift Operator",
  "React Developer",
];

const LOCATIONS = [
  "All Locations",
  "Valenzuela (HQ)",
  "Quezon City",
  "Metro Manila",
  "Laguna",
  "Cavite",
  "Batangas",
  "Cebu",
  "Davao",
];

export const HeroSearch: React.FC<HeroSearchProps> = ({
  initialSearch = "",
  initialLocation = "",
  className = "",
  onSearch,
  targetPath = "/app/jobs",
}) => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState(initialSearch);
  const [location, setLocation] = useState(initialLocation);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(keyword, location === "All Locations" ? "" : location);
      return;
    }

    const locParam = location && location !== "All Locations" ? location : undefined;
    void navigate({
      to: targetPath as any,
      search: {
        search: keyword.trim() || undefined,
        location: locParam,
      } as any,
    });
  };

  const handleTagClick = (tag: string) => {
    setKeyword(tag);
    if (onSearch) {
      onSearch(tag, location === "All Locations" ? "" : location);
      return;
    }
    const locParam = location && location !== "All Locations" ? location : undefined;
    void navigate({
      to: targetPath as any,
      search: {
        search: tag,
        location: locParam,
      } as any,
    });
  };

  return (
    <div className={`w-full max-w-4xl mx-auto space-y-3.5 ${className}`}>
      {/* Unified Search Container */}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200 shadow-lg flex flex-col md:flex-row items-stretch gap-2"
      >
        {/* Keyword Input */}
        <div className="flex-1 flex items-center gap-3 px-3 py-2 border-b md:border-b-0 md:border-r border-slate-200">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Job title, skill, or keyword (e.g. Electrician, Admin, React)..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            aria-label="Job title, skill, or keyword"
          />
        </div>

        {/* Location Selector */}
        <div className="flex items-center gap-2 px-3 py-2 md:w-64">
          <MapPin className="w-5 h-5 text-slate-400 shrink-0" />
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-700 focus:outline-none cursor-pointer"
            aria-label="Job location"
          >
            {LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        {/* Submit CTA */}
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 shrink-0 cursor-pointer"
        >
          <span>Search Jobs</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Popular Search Suggestions */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-1">
        <span className="font-semibold text-slate-700">Trending searches:</span>
        {POPULAR_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => handleTagClick(tag)}
            className="px-2.5 py-1 rounded-full bg-white/90 hover:bg-white border border-slate-200/90 text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-colors shadow-2xs cursor-pointer"
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
};
