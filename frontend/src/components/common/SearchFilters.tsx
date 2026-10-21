import React, { useId, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "../ui/Input";
import { ComboBox } from "../ui/ComboBox";
import { cn } from "../../lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  subtitle?: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  placeholder?: string;
  searchable?: boolean;
}

export interface SearchFiltersProps {
  searchLabel?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  filters?: FilterConfig[];
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  onReset?: () => void;
  actions?: React.ReactNode;
  className?: string;
  /**
   * "stacked" puts search, filters and `trailing` on one full-width row and the
   * actions on a second row, so wide toolbars do not leave a gap in the middle.
   */
  layout?: "inline" | "stacked";
  /** Rendered at the end of the search row in the stacked layout (e.g. a sort control). */
  trailing?: React.ReactNode;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  searchLabel = "Search",
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearchChange,
  filters = [],
  filterValues = {},
  onFilterChange,
  onReset,
  actions,
  className,
  layout = "inline",
  trailing,
}) => {
  const stacked = layout === "stacked";
  const idPrefix = useId();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = filters.filter((f) => {
    const v = filterValues[f.key];
    return Boolean(v) && v !== "ALL";
  }).length;
  const filtersId = `${idPrefix}-filters`;
  const hasActiveFilters =
    Boolean(searchValue) ||
    Object.values(filterValues).some((val) => val && val !== "ALL");

  return (
    <div
      role="search"
      aria-label="Search and filter records"
      className={cn(
        stacked
          ? "bg-white p-3 border border-slate-300 mb-4 flex flex-col gap-2.5"
          : "bg-white p-3 border border-slate-300 mb-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3",
        className
      )}
    >
      {/* Search and Filters group */}
      <div className="flex flex-1 flex-wrap items-center gap-2.5">
        {/* Search Bar */}
        {onSearchChange && (
          <div className={stacked ? "w-full sm:min-w-64 sm:flex-1" : "w-full sm:w-72 md:w-96"}>
            <label htmlFor={`${idPrefix}-search`} className="sr-only">
              {searchLabel}
            </label>
            <Input
              id={`${idPrefix}-search`}
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
                    aria-label={`Clear ${searchLabel.toLowerCase()}`}
                    className="p-2 text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : undefined
              }
            />
          </div>
        )}

        {/* Below md the filters collapse behind a disclosure; the search box stays visible. */}
        {filters.length > 0 && (
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls={filtersId}
            onClick={() => setFiltersOpen((v) => !v)}
            className="md:hidden inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-1"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            {activeFilterCount > 0 ? `Filters (${activeFilterCount} active)` : "Filters"}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", filtersOpen && "rotate-180")} aria-hidden="true" />
          </button>
        )}

        <div
          id={filtersId}
          className={cn("w-full flex-wrap items-center gap-2.5 md:flex md:w-auto", filtersOpen ? "flex" : "hidden")}
        >
        {filters.map((filter) => (
          <div key={filter.key} className={stacked ? "w-full sm:w-auto sm:min-w-52" : "w-full sm:w-auto min-w-[150px]"}>
            <label htmlFor={`${idPrefix}-${filter.key}`} className="sr-only">
              {filter.label}
            </label>
            {filter.searchable ? (
              <ComboBox
                id={`${idPrefix}-${filter.key}`}
                size="sm"
                placeholder={filter.placeholder || `${filter.label}: all`}
                value={filterValues[filter.key] || ""}
                onChange={(val) => onFilterChange?.(filter.key, val || "")}
                options={[
                  { value: "", label: filter.placeholder || `${filter.label}: all` },
                  ...filter.options,
                ]}
                clearable={Boolean(filterValues[filter.key])}
              />
            ) : (
              <select
                id={`${idPrefix}-${filter.key}`}
                value={filterValues[filter.key] || ""}
                onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
                className="w-full min-h-11 md:min-h-10 rounded-md px-3 py-2 text-sm font-sans border border-slate-300 bg-white text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-1 focus:border-navy transition-colors cursor-pointer"
              >
                <option value="">
                  {filter.placeholder || `${filter.label}: all`}
                </option>
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
        </div>

        {stacked && trailing}

        {/* Clear Filters CTA */}
        {hasActiveFilters && onReset && (
          <button
            type="button"
            onClick={onReset}
            className="min-h-11 text-sm text-rose-700 hover:text-rose-900 flex items-center gap-1 font-medium select-none px-2 py-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-1 rounded"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Extra Action Buttons slot */}
      {actions && (
        <div
          className={
            stacked
              ? "flex flex-wrap items-center gap-2 w-full"
              : "flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto justify-end sm:justify-start lg:self-center"
          }
        >
          {actions}
        </div>
      )}
    </div>
  );
};
