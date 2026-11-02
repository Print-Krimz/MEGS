import React, { useState, useEffect, useId, useMemo, useRef } from "react";
import { formatRecruiterName } from "../../lib/recruiter-label";
import { Filter, RotateCcw, Calendar as CalendarIcon, X } from "lucide-react";
import { formatDate } from "../../lib/utils";
import { Button, ComboBox } from "../ui";
import type { ComboBoxOption } from "../ui/ComboBox";
import type { AnalyticsFilterOptions, AnalyticsFilterState, AnalyticsDateRangePreset } from "../../lib/types/analytics.types";

interface AnalyticsFilterBarProps {
  filters: AnalyticsFilterState;
  onChange: (filters: AnalyticsFilterState) => void;
  options?: AnalyticsFilterOptions;
  showRecruiterFilter?: boolean;
  showClientFilter?: boolean;
}

// Days in a custom range counting both ends, worked out the same way the server checks it (validate.middleware.ts).
const inclusiveRangeDays = (startDate: string, endDate: string): number =>
  (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000 + 1;

// A custom range needs both dates, in order, and at most 366 days inclusive (the server enforces the same limit).
const customRangeProblem = (startDate: string, endDate: string): string | null =>
  !startDate || !endDate
    ? "Choose a start and an end date."
    : startDate > endDate
      ? "The start date must be on or before the end date."
      : inclusiveRangeDays(startDate, endDate) > 366
        ? "Choose a date range of 366 days or fewer."
        : null;

export const AnalyticsFilterBar: React.FC<AnalyticsFilterBarProps> = ({
  filters,
  onChange,
  options,
  showRecruiterFilter = false,
  showClientFilter = false,
}) => {
  const moreFiltersId = useId();
  const rangeErrorId = useId();
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  // Only the custom dates are held back: they apply once both are chosen and valid. Everything else applies at once.
  const [customOpen, setCustomOpen] = useState(filters.range === "custom");
  const [draftStart, setDraftStart] = useState(filters.startDate ?? "");
  const [draftEnd, setDraftEnd] = useState(filters.endDate ?? "");

  // Follow outside changes (clear, chip removal).
  useEffect(() => {
    setCustomOpen(filters.range === "custom");
    setDraftStart(filters.startDate ?? "");
    setDraftEnd(filters.endDate ?? "");
  }, [filters.range, filters.startDate, filters.endDate]);

  const handleRangePreset = (range: AnalyticsDateRangePreset) => {
    if (range === "custom") {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    onChange({ ...filters, range, startDate: undefined, endDate: undefined });
  };

  const handleCustomDate = (which: "start" | "end", value: string) => {
    const startDate = which === "start" ? value : draftStart;
    const endDate = which === "end" ? value : draftEnd;
    if (which === "start") setDraftStart(value);
    else setDraftEnd(value);
    if (customRangeProblem(startDate, endDate) === null) {
      onChange({ ...filters, range: "custom", startDate, endDate });
    }
  };

  const handleClearAll = () => {
    setCustomOpen(false);
    onChange({
      range: "7d",
      startDate: undefined,
      endDate: undefined,
      clientId: undefined,
      mrfId: undefined,
      jobPostingId: undefined,
      recruiterId: undefined,
    });
  };

  // Helper to remove a single active filter immediately
  const handleRemoveFilter = (key: keyof AnalyticsFilterState) => {
    const updated: AnalyticsFilterState = {
      ...filters,
      [key]: key === "range" ? "7d" : undefined,
    };
    if (key === "range") {
      updated.startDate = undefined;
      updated.endDate = undefined;
    }
    onChange(updated);
  };

  const customRangeError = customOpen ? customRangeProblem(draftStart, draftEnd) : null;
  const showCustomDates = customOpen;

  // Check if any filter is active (differs from default clean 7d state)
  const hasActiveFilters =
    filters.range !== "7d" ||
    filters.clientId !== undefined ||
    filters.mrfId !== undefined ||
    filters.jobPostingId !== undefined ||
    filters.recruiterId !== undefined ||
    Boolean(filters.startDate) ||
    Boolean(filters.endDate);

  // Cascading MRF -> Job Posting list
  const availableJobPostings = useMemo(() => {
    if (!options?.jobPostings) return [];
    if (!filters.mrfId) return options.jobPostings;
    return options.jobPostings.filter((j) => Number(j.mrfId) === Number(filters.mrfId));
  }, [options?.jobPostings, filters.mrfId]);

  // Transform options into ComboBoxOption items
  const clientOptions: ComboBoxOption[] = useMemo(() => {
    return (options?.clients || []).map((c) => ({
      value: String(c.id),
      label: c.name,
    }));
  }, [options?.clients]);

  const mrfOptions: ComboBoxOption[] = useMemo(() => {
    let list = options?.mrfs || [];
    if (filters.clientId) {
      list = list.filter((m) => Number(m.clientId) === Number(filters.clientId));
    }
    return list.map((m) => ({
      value: String(m.id),
      label: m.title,
       subtitle: `Request #${m.id}`,
    }));
  }, [options?.mrfs, filters.clientId]);

  const jobOptions: ComboBoxOption[] = useMemo(() => {
    return availableJobPostings.map((j) => ({
      value: String(j.id),
      label: j.title,
       subtitle: j.mrfId ? `Linked to request #${j.mrfId}` : "Direct job opening",
    }));
  }, [availableJobPostings]);

  const recruiterOptions: ComboBoxOption[] = useMemo(() => {
    return (options?.recruiters || []).map((r) => ({
      value: r.id,
      label: formatRecruiterName(r.name).label,
      subtitle: r.email,
    }));
  }, [options?.recruiters]);

  // Active filters in words, for the chips and the screen-reader announcement.
  const activeChips = useMemo(() => {
    const chips: { key: keyof AnalyticsFilterState; label: string; value: string }[] = [];

    if (filters.range && filters.range !== "7d") {
      const rangeLabels: Record<string, string> = {
        "30d": "Last 30 days",
        "90d": "Last 90 days",
        custom: filters.startDate && filters.endDate ? `${formatDate(filters.startDate)} to ${formatDate(filters.endDate)}` : "Custom range",
      };
      chips.push({ key: "range", label: "Date", value: rangeLabels[filters.range] || filters.range });
    }

    if (filters.clientId) {
      const c = options?.clients.find((x) => x.id === filters.clientId);
      chips.push({ key: "clientId", label: "Client", value: c?.name || `Client #${filters.clientId}` });
    }

    if (filters.mrfId) {
      const m = options?.mrfs.find((x) => x.id === filters.mrfId);
      chips.push({ key: "mrfId", label: "Client request", value: m?.title || `Request #${filters.mrfId}` });
    }

    if (filters.jobPostingId) {
      const j = options?.jobPostings.find((x) => x.id === filters.jobPostingId);
      chips.push({ key: "jobPostingId", label: "Job opening", value: j?.title || `Job #${filters.jobPostingId}` });
    }

    if (filters.recruiterId) {
      const r = options?.recruiters.find((x) => x.id === filters.recruiterId);
      chips.push({ key: "recruiterId", label: "Recruiter", value: r ? formatRecruiterName(r.name).label : filters.recruiterId });
    }

    return chips;
  }, [filters, options]);

  // Announce the result of a change, not the first render.
  const summary = [
    activeChips.some((c) => c.key === "range") ? "" : "Last 7 days",
    ...activeChips.map((c) => (c.key === "range" ? c.value : `${c.label}: ${c.value}`)),
  ]
    .filter(Boolean)
    .join(", ");
  const [announcement, setAnnouncement] = useState("");
  const previousSummary = useRef(summary);
  useEffect(() => {
    if (previousSummary.current === summary) return;
    previousSummary.current = summary;
    setAnnouncement(`Showing results for ${summary}`);
  }, [summary]);

  const errorProps = customRangeError ? { "aria-invalid": true, "aria-describedby": rangeErrorId } : {};
  const dateInputClass =
    "border border-slate-300 bg-white px-2 py-1 pointer-coarse:min-h-11 text-xs text-slate-900 focus:outline-none focus:border-navy aria-[invalid=true]:border-rose-600";

  return (
    <div className="border border-slate-300 bg-white p-3 space-y-3">
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      {/* Top row: date range presets and actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mr-2">
            <CalendarIcon className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span>Date range</span>
          </div>

          {(
            [
              { key: "7d", label: "Last 7 days" },
              { key: "30d", label: "Last 30 days" },
              { key: "90d", label: "Last 90 days" },
              { key: "custom", label: "Custom range" },
            ] as const
          ).map((preset) => {
            const isActive = customOpen ? preset.key === "custom" : filters.range === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => handleRangePreset(preset.key)}
                aria-pressed={isActive}
                className={`min-h-11 md:min-h-9 pointer-coarse:min-h-11 px-2.5 py-1 text-sm font-semibold border transition-colors cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              leftIcon={<RotateCcw className="w-3 h-3 text-slate-500" />}
              className="text-slate-700 hover:text-slate-950 text-sm max-md:min-h-11 pointer-coarse:min-h-11"
            >
              Clear filters
            </Button>
          )}
          {options && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMoreFilters((current) => !current)}
              aria-expanded={showMoreFilters}
              aria-controls={moreFiltersId}
              className="text-sm max-md:min-h-11 pointer-coarse:min-h-11"
            >
              {showMoreFilters ? "Hide filters" : "More filters"}
            </Button>
          )}
        </div>
      </div>

      {/* Custom dates apply once both are chosen and valid */}
      {showCustomDates && (
        <div className="p-2.5 bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="analytics-start-date" className="text-slate-600 font-semibold">From</label>
            <input
              type="date"
              min="1900-01-01"
              max={draftEnd || "2100-12-31"}
              id="analytics-start-date"
              value={draftStart}
              onChange={(e) => handleCustomDate("start", e.target.value)}
              className={dateInputClass}
              {...errorProps}
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="analytics-end-date" className="text-slate-600 font-semibold">To</label>
            <input
              type="date"
              min={draftStart || "1900-01-01"}
              max="2100-12-31"
              id="analytics-end-date"
              value={draftEnd}
              onChange={(e) => handleCustomDate("end", e.target.value)}
              className={dateInputClass}
              {...errorProps}
            />
          </div>
          {customRangeError && (
            <p id={rangeErrorId} role="alert" className="text-xs text-rose-700 font-sans">
              {customRangeError}
            </p>
          )}
        </div>
      )}

      {/* Searchable dropdowns; each choice applies at once */}
      {options && showMoreFilters && (
        <div id={moreFiltersId} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
          {showClientFilter && options.clients && options.clients.length > 0 && (
            <ComboBox
              label="Client"
              options={clientOptions}
              value={filters.clientId ? String(filters.clientId) : ""}
              onChange={(val) => {
                const clientId = val ? parseInt(val, 10) : undefined;
                const next = { ...filters, clientId };
                // A request that belongs to another client no longer applies.
                if (next.mrfId) {
                  const mrfObj = options.mrfs.find((m) => m.id === next.mrfId);
                  if (clientId && mrfObj && mrfObj.clientId !== clientId) {
                    next.mrfId = undefined;
                    next.jobPostingId = undefined;
                  }
                }
                onChange(next);
              }}
              placeholder="All Clients"
              clearable={true}
              size="sm"
            />
          )}

          {options.mrfs && options.mrfs.length > 0 && (
            <ComboBox
              label="Client request"
              options={mrfOptions}
              value={filters.mrfId ? String(filters.mrfId) : ""}
              onChange={(val) => {
                const mrfId = val ? parseInt(val, 10) : undefined;
                const next = { ...filters, mrfId };
                // A job opening that belongs to another request no longer applies.
                if (next.jobPostingId) {
                  const jobObj = options.jobPostings.find((j) => j.id === next.jobPostingId);
                  if (mrfId && jobObj && jobObj.mrfId !== mrfId) {
                    next.jobPostingId = undefined;
                  }
                }
                onChange(next);
              }}
              placeholder="All client requests"
              clearable={true}
              size="sm"
            />
          )}

          {options.jobPostings && options.jobPostings.length > 0 && (
            <ComboBox
              label="Job opening"
              options={jobOptions}
              value={filters.jobPostingId ? String(filters.jobPostingId) : ""}
              onChange={(val) => onChange({ ...filters, jobPostingId: val ? parseInt(val, 10) : undefined })}
              placeholder={filters.mrfId ? "Select job opening" : "All job openings"}
              clearable={true}
              size="sm"
            />
          )}

          {showRecruiterFilter && options.recruiters && options.recruiters.length > 0 && (
            <ComboBox
              label="Recruiter"
              options={recruiterOptions}
              value={filters.recruiterId || ""}
              onChange={(val) => onChange({ ...filters, recruiterId: val || undefined })}
              placeholder="All recruiters"
              clearable={true}
              size="sm"
            />
          )}
        </div>
      )}

      {/* Active filters in words, each removable */}
      {activeChips.length > 0 && (
        <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mr-1">
            <Filter className="w-3.5 h-3.5 text-navy" aria-hidden="true" />
            <span>Filters applied</span>
            <span className="px-1.5 py-0.2 bg-navy-soft text-navy text-xs border border-navy-line font-semibold">
              {activeChips.length}
            </span>
          </div>

          {activeChips.map((chip) => (
            <span
              key={chip.key}
              data-testid={`active-filter-chip-${chip.key}`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 text-xs"
            >
              <span className="text-slate-600 font-semibold text-xs">{chip.label}:</span>
              <span className="font-bold text-slate-900 max-w-[200px] truncate">{chip.value}</span>
              <button
                type="button"
                onClick={() => handleRemoveFilter(chip.key)}
                className="relative hover:text-rose-700 text-slate-500 font-bold ml-0.5 cursor-pointer pointer-coarse:before:absolute pointer-coarse:before:-inset-3.5 pointer-coarse:before:content-['']"
                title={`Remove ${chip.label} filter`}
                aria-label={`Remove ${chip.label} filter`}
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
