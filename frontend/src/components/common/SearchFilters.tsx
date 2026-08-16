import React from "react";
import { Search, X } from "lucide-react";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  placeholder?: string;
}

export interface SearchFiltersProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  filters?: FilterConfig[];
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  onReset?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  searchPlaceholder = "Search records...",
  searchValue = "",
  onSearchChange,
  filters = [],
  filterValues = {},
  onFilterChange,
  onReset,
  actions,
  className,
}) => {
  const hasActiveFilters =
    Boolean(searchValue) ||
    Object.values(filterValues).some((val) => val && val !== "ALL");

  return (
    <div
      className={cn(
        "bg-white p-3 border border-slate-300 mb-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5",
        className
      )}
    >
      {/* Search and Filters group */}
      <div className="flex flex-1 flex-wrap items-center gap-2.5">
        {/* Search Bar */}
        {onSearchChange && (
          <div className="w-full sm:w-64 md:w-80">
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              leftIcon={<Search className="w-3.5 h-3.5 text-slate-400" />}
              rightIcon={
                searchValue ? (
                  <button
                    type="button"
                    onClick={() => onSearchChange("")}
                    className="p-0.5 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : undefined
              }
            />
          </div>
        )}

        {/* Custom Filter Dropdowns */}
        {filters.map((filter) => (
          <div key={filter.key} className="w-full sm:w-auto min-w-[140px]">
            <select
              value={filterValues[filter.key] || ""}
              onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700 focus:border-teal-700 transition-colors cursor-pointer"
            >
              <option value="">{filter.placeholder || (filter.label.endsWith("s") ? `All ${filter.label}` : `All ${filter.label}s`)}</option>
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        {/* Clear Filters CTA */}
        {hasActiveFilters && onReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-rose-700 hover:text-rose-900 flex items-center gap-1 font-mono uppercase tracking-wider select-none px-2 py-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Extra Action Buttons slot */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
          {actions}
        </div>
      )}
    </div>
  );
};
