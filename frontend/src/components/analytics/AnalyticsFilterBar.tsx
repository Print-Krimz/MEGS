import React, { useState, useEffect, useId, useMemo, useRef } from "react";
import { formatRecruiterName } from "../../lib/recruiter-label";
import { STAGE_RAMP } from "../../lib/chart-palette";
import { Filter, RotateCcw, Calendar as CalendarIcon, SlidersHorizontal, X } from "lucide-react";
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
  /** Shown inside the same frame under a divider, e.g. the "Needs action" chips. */
  footer?: React.ReactNode;
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

const STATUS_OPTIONS: ComboBoxOption[] = [
  { value: "critical", label: "Critical wait (≥2x limit)" },
  { value: "overdue", label: "Overdue candidates" },
  { value: "late_request", label: "Overdue or at-risk requests" },
  { value: "filled_request", label: "Filled requests" },
];

const PRESETS = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "custom", label: "Custom range" },
] as const;

export const AnalyticsFilterBar: React.FC<AnalyticsFilterBarProps> = ({
  filters,
  onChange,
  options,
  showRecruiterFilter = false,
  showClientFilter = false,
  footer,
}) => {
  const moreFiltersId = useId();
  const rangeErrorId = useId();
  const dateNoteId = useId();
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
      stage: undefined,
      status: undefined,
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
    filters.stage !== undefined ||
    filters.status !== undefined ||
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

  const stageOptions: ComboBoxOption[] = useMemo(() => {
    const list = options?.stages && options.stages.length > 0
      ? options.stages.map((s) => ({ value: s.key, label: s.label }))
      : STAGE_RAMP.map((s) => ({ value: s.key, label: s.label }));
    return list;
  }, [options?.stages]);

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

    if (filters.stage) {
      const s = stageOptions.find((x) => x.value === filters.stage);
      chips.push({ key: "stage", label: "Stage", value: s?.label || filters.stage });
    }

    if (filters.status) {
      const st = STATUS_OPTIONS.find((x) => x.value === filters.status);
      chips.push({ key: "status", label: "Status", value: st?.label || filters.status });
    }

    return chips;
  }, [filters, options, stageOptions]);

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
    "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 pointer-coarse:min-h-11 text-xs font-medium text-slate-900 focus:outline-none focus:border-navy aria-[invalid=true]:border-rose-600";

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-[0_1px_3px_0_rgb(15_23_42/0.06)]">
      <div aria-hidden="true" className="h-1 w-full bg-navy" />
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      {/* Top row: date range presets and actions */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-slate-200 bg-gradient-to-r from-[#F4F7FB] via-white to-[#F8FAFC] px-4 py-3 md:flex md:flex-wrap md:justify-between md:gap-3">
        {/* Phones: one select keeps the bar to a single row */}
        <select
          aria-label="Date range"
          aria-describedby={dateNoteId}
          value={customOpen ? "custom" : (filters.range ?? "7d")}
          onChange={(e) => handleRangePreset(e.target.value as AnalyticsDateRangePreset)}
          className="min-h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2.5 text-sm font-semibold text-slate-800 md:hidden"
        >
          {PRESETS.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {preset.label}
            </option>
          ))}
        </select>

        <div role="group" aria-label="Date range" aria-describedby={dateNoteId} className="hidden flex-wrap items-center gap-2 md:flex">
          <div className="mr-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
            <CalendarIcon className="h-3.5 w-3.5 text-navy" aria-hidden="true" />
            <span>Date range</span>
          </div>

          <div className="inline-flex flex-wrap items-center gap-1 rounded-md border border-slate-300 bg-slate-100/90 p-0.5">
            {PRESETS.map((preset) => {
              const isActive = customOpen ? preset.key === "custom" : filters.range === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => handleRangePreset(preset.key)}
                  aria-pressed={isActive}
                  className={`md:min-h-8 pointer-coarse:min-h-11 rounded-[5px] px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-navy text-white shadow-[0_1px_2px_0_rgb(11_49_93/0.25)]"
                      : "bg-transparent text-slate-700 hover:bg-white/80 hover:text-slate-950"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              leftIcon={<RotateCcw className="w-3 h-3 text-slate-600" />}
              className="text-slate-700 hover:text-slate-950 text-xs font-semibold max-md:min-h-11 pointer-coarse:min-h-11"
            >
              Clear filters
            </Button>
          )}
          {options && (
            <Button
              variant={showMoreFilters ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowMoreFilters((current) => !current)}
              aria-expanded={showMoreFilters}
              aria-controls={moreFiltersId}
              leftIcon={<SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />}
              className="text-xs font-semibold max-md:min-h-11 pointer-coarse:min-h-11"
            >
              {showMoreFilters ? "Hide filters" : "More filters"}
            </Button>
          )}
        </div>

        {/* Full width, so it sits on its own line under the date controls */}
        <p id={dateNoteId} className="col-span-2 w-full text-xs text-slate-600 leading-relaxed">
          Dates apply to “In these dates”, the starts and backouts chart and Why candidates backed out. “Right now” figures are live.
        </p>
      </div>

      {/* Custom dates apply once both are chosen and valid */}
      {showCustomDates && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 flex flex-wrap items-center gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="analytics-start-date" className="text-slate-700 font-semibold">From</label>
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
            <label htmlFor="analytics-end-date" className="text-slate-700 font-semibold">To</label>
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
            <p id={rangeErrorId} role="alert" className="text-xs font-medium text-rose-700 font-sans">
              {customRangeError}
            </p>
          )}
        </div>
      )}

      {/* Searchable dropdowns; each choice applies at once */}
      {options && showMoreFilters && (
        <div id={moreFiltersId} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3.5">
          {showClientFilter && options.clients && options.clients.length > 0 && (
            <ComboBox
              label="Client"
              options={clientOptions}
              value={filters.clientId ? String(filters.clientId) : ""}
              onChange={(val) => {
                const clientId = val ? parseInt(val, 10) : undefined;
                const next = { ...filters, clientId };
                if (next.mrfId) {
                  const mrfObj = options.mrfs.find((m) => m.id === next.mrfId);
                  if (clientId && mrfObj && mrfObj.clientId !== clientId) {
                    next.mrfId = undefined;
                    next.jobPostingId = undefined;
                  }
                }
                onChange(next);
              }}
              placeholder="All clients"
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

          {stageOptions.length > 0 && (
            <ComboBox
              label="Stage"
              options={stageOptions}
              value={filters.stage || ""}
              onChange={(val) => onChange({ ...filters, stage: val || undefined })}
              placeholder="All stages"
              clearable={true}
              size="sm"
            />
          )}

          <ComboBox
            label="Status"
            options={STATUS_OPTIONS}
            value={filters.status || ""}
            onChange={(val) => onChange({ ...filters, status: val || undefined })}
            placeholder="All statuses"
            clearable={true}
            size="sm"
          />
        </div>
      )}

      {/* Active filters in words, each removable */}
      {activeChips.length > 0 && (
        <div className="border-b border-slate-200 bg-navy-soft/30 px-4 py-2.5 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-navy mr-1">
            <Filter className="w-3.5 h-3.5 text-navy" aria-hidden="true" />
            <span>Filters applied</span>
            <span className="rounded-sm px-1.5 py-0.5 bg-navy text-white text-xs font-bold tabular-nums">
              {activeChips.length}
            </span>
          </div>

          {activeChips.map((chip) => (
            <span
              key={chip.key}
              data-testid={`active-filter-chip-${chip.key}`}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 bg-white text-slate-800 border border-navy-line text-xs shadow-2xs"
            >
              <span className="text-slate-600 font-semibold text-xs">{chip.label}:</span>
              <span className="font-bold text-navy max-w-[200px] truncate">{chip.value}</span>
              <button
                type="button"
                onClick={() => handleRemoveFilter(chip.key)}
                className="relative inline-flex min-h-6 min-w-6 items-center justify-center max-md:min-h-11 max-md:min-w-11 hover:text-rose-700 text-slate-500 font-bold ml-0.5 cursor-pointer pointer-coarse:before:absolute pointer-coarse:before:-inset-3.5 pointer-coarse:before:content-['']"
                title={`Remove ${chip.label} filter`}
                aria-label={`Remove ${chip.label} filter`}
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      {footer && <div className="bg-slate-50/70 px-4 py-3">{footer}</div>}
    </div>
  );
};
