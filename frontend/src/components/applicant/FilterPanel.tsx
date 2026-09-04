import React, { useState, useEffect } from "react";
import {
  SlidersHorizontal,
  X,
  RotateCcw,
  MapPin,
  Briefcase,
  Layers,
  Building2,
  Check,
} from "lucide-react";

export interface FilterState {
  category?: string;
  location?: string;
  workSetup?: string;
  employmentType?: string;
  search?: string;
}

export interface FilterPanelProps {
  filters: FilterState;
  onChange: (newFilters: FilterState) => void;
  onReset: () => void;
  totalResults?: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

const CATEGORIES = [
  "Manufacturing & Production",
  "Logistics & Warehousing",
  "Technical & Engineering",
  "Information Technology",
  "Administrative & Office",
  "Accounting & Finance",
  "Sales & Commercial",
  "Retail & Merchandising",
];

const LOCATIONS = [
  "Valenzuela (HQ)",
  "Quezon City",
  "Metro Manila",
  "Laguna",
  "Cavite",
  "Batangas",
  "Cebu",
  "Davao",
];

const WORK_SETUPS = [
  { value: "ON_SITE", label: "On-site" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "REMOTE", label: "Remote" },
];

const EMPLOYMENT_TYPES = [
  { value: "Full-time", label: "Full-time" },
  { value: "Part-time", label: "Part-time" },
  { value: "Contract", label: "Contractual / Project" },
  { value: "Seasonal", label: "Seasonal" },
];

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onChange,
  onReset,
  totalResults,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const activeCount = Object.values(filters).filter(Boolean).length;

  const handleUpdate = (key: keyof FilterState, val: string | undefined) => {
    onChange({
      ...filters,
      [key]: filters[key] === val ? undefined : val,
    });
  };

  // Close mobile drawer on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpenMobile && onCloseMobile) {
        onCloseMobile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpenMobile, onCloseMobile]);

  const FilterContent = (
    <div className="space-y-6">
      {/* Header with Active Filters Count and Reset */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-700" />
          <h3 className="font-bold text-slate-900 text-sm">Filters</h3>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              {activeCount}
            </span>
          )}
        </div>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset All</span>
          </button>
        )}
      </div>

      {/* 1. Work Arrangement */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
          <span>Work Arrangement</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {WORK_SETUPS.map((setup) => {
            const isSelected = filters.workSetup === setup.value;
            return (
              <button
                key={setup.value}
                type="button"
                onClick={() => handleUpdate("workSetup", setup.value)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border text-center transition-all ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {setup.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Location */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          <span>Location</span>
        </label>
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          {LOCATIONS.map((loc) => {
            const isSelected = filters.location === loc;
            return (
              <button
                key={loc}
                type="button"
                onClick={() => handleUpdate("location", loc)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left ${
                  isSelected
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-100/70"
                }`}
              >
                <span>{loc}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Job Category */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span>Job Category</span>
        </label>
        <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
          {CATEGORIES.map((cat) => {
            const isSelected = filters.category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleUpdate("category", cat)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left ${
                  isSelected
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-100/70"
                }`}
              >
                <span className="truncate">{cat}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Employment Type */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span>Employment Type</span>
        </label>
        <div className="space-y-1">
          {EMPLOYMENT_TYPES.map((type) => {
            const isSelected = filters.employmentType === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => handleUpdate("employmentType", type.value)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left ${
                  isSelected
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-100/70"
                }`}
              >
                <span>{type.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:block w-72 shrink-0">
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 sticky top-20 shadow-xs">
          {FilterContent}
        </div>
      </aside>

      {/* Mobile Bottom Sheet / Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />

          {/* Drawer Body */}
          <div className="relative bg-white rounded-t-2xl max-h-[85vh] flex flex-col shadow-xl z-10 animate-in slide-in-from-bottom duration-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-slate-700" />
                <h3 className="font-bold text-slate-900 text-base">Filter Opportunities</h3>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                aria-label="Close filters"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">{FilterContent}</div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center gap-3">
              <button
                type="button"
                onClick={onReset}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Reset All
              </button>
              <button
                type="button"
                onClick={onCloseMobile}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-xs"
              >
                {totalResults !== undefined ? `Show ${totalResults} Jobs` : "Apply Filters"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
