import React, { useState, useEffect, useMemo } from "react";
import { Filter, RotateCcw, Calendar as CalendarIcon, X, Check, SlidersHorizontal } from "lucide-react";
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

export const AnalyticsFilterBar: React.FC<AnalyticsFilterBarProps> = ({
  filters,
  onChange,
  options,
  showRecruiterFilter = false,
  showClientFilter = false,
}) => {
  // Local draft state for user configuration before clicking "Apply Filters"
  const [draftFilters, setDraftFilters] = useState<AnalyticsFilterState>(filters);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Sync draft filters whenever external filters change (e.g. parent reset or chip removal)
  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  const handleRangePreset = (range: AnalyticsDateRangePreset) => {
    setDraftFilters((prev) => ({
      ...prev,
      range,
      startDate: undefined,
      endDate: undefined,
    }));
  };

  const handleApply = () => {
    onChange(draftFilters);
  };

  const handleClearAll = () => {
    const cleared: AnalyticsFilterState = {
      range: "30d",
      startDate: undefined,
      endDate: undefined,
      clientId: undefined,
      mrfId: undefined,
      jobPostingId: undefined,
      stage: undefined,
      recruiterId: undefined,
    };
    setDraftFilters(cleared);
    onChange(cleared);
  };

  // Helper to remove a single active filter immediately
  const handleRemoveFilter = (key: keyof AnalyticsFilterState) => {
    const updated: AnalyticsFilterState = {
      ...filters,
      [key]: key === "range" ? "30d" : undefined,
    };
    if (key === "range") {
      updated.startDate = undefined;
      updated.endDate = undefined;
    }
    // If MRF is removed, check if job posting still belongs or keep it
    setDraftFilters(updated);
    onChange(updated);
  };

  // Check if draft filters differ from currently applied filters
  const hasUnappliedChanges = useMemo(() => {
    return JSON.stringify(draftFilters) !== JSON.stringify(filters);
  }, [draftFilters, filters]);

  // Check if any filter is active (differs from default clean 30d state)
  const hasActiveFilters = useMemo(() => {
    return (
      filters.range !== "30d" ||
      filters.clientId !== undefined ||
      filters.mrfId !== undefined ||
      filters.jobPostingId !== undefined ||
      filters.stage !== undefined ||
      filters.recruiterId !== undefined ||
      Boolean(filters.startDate) ||
      Boolean(filters.endDate)
    );
  }, [filters]);

  // Cascading MRF -> Job Posting list
  const availableJobPostings = useMemo(() => {
    if (!options?.jobPostings) return [];
    if (!draftFilters.mrfId) return options.jobPostings;
    return options.jobPostings.filter((j) => Number(j.mrfId) === Number(draftFilters.mrfId));
  }, [options?.jobPostings, draftFilters.mrfId]);

  // Transform options into ComboBoxOption items
  const clientOptions: ComboBoxOption[] = useMemo(() => {
    return (options?.clients || []).map((c) => ({
      value: String(c.id),
      label: c.name,
    }));
  }, [options?.clients]);

  const mrfOptions: ComboBoxOption[] = useMemo(() => {
    let list = options?.mrfs || [];
    if (draftFilters.clientId) {
      list = list.filter((m) => Number(m.clientId) === Number(draftFilters.clientId));
    }
    return list.map((m) => ({
      value: String(m.id),
      label: m.title,
       subtitle: `Request #${m.id}`,
    }));
  }, [options?.mrfs, draftFilters.clientId]);

  const jobOptions: ComboBoxOption[] = useMemo(() => {
    return availableJobPostings.map((j) => ({
      value: String(j.id),
      label: j.title,
       subtitle: j.mrfId ? `Linked to request #${j.mrfId}` : "Direct job opening",
    }));
  }, [availableJobPostings]);

  const stageOptions: ComboBoxOption[] = useMemo(() => {
    return (options?.stages || []).map((s) => ({
      value: s.key,
      label: s.label,
    }));
  }, [options?.stages]);

  const recruiterOptions: ComboBoxOption[] = useMemo(() => {
    return (options?.recruiters || []).map((r) => ({
      value: r.id,
      label: r.name,
      subtitle: r.email,
    }));
  }, [options?.recruiters]);

  // Active filter chip labels for applied filters
  const activeChips = useMemo(() => {
    const chips: { key: keyof AnalyticsFilterState; label: string; value: string }[] = [];

    if (filters.range && filters.range !== "30d") {
      const rangeLabels: Record<string, string> = {
        "7d": "Last 7 Days",
        "90d": "Last 90 Days",
        custom: filters.startDate && filters.endDate ? `${filters.startDate} to ${filters.endDate}` : "Custom Range",
      };
      chips.push({ key: "range", label: "Date", value: rangeLabels[filters.range] || filters.range });
    }

    if (filters.clientId) {
      const c = options?.clients.find((x) => x.id === filters.clientId);
      chips.push({ key: "clientId", label: "Client", value: c?.name || `Client #${filters.clientId}` });
    }

    if (filters.mrfId) {
      const m = options?.mrfs.find((x) => x.id === filters.mrfId);
       chips.push({ key: "mrfId", label: "Hiring request", value: m?.title || `Request #${filters.mrfId}` });
    }

    if (filters.jobPostingId) {
      const j = options?.jobPostings.find((x) => x.id === filters.jobPostingId);
       chips.push({ key: "jobPostingId", label: "Job opening", value: j?.title || `Job #${filters.jobPostingId}` });
    }

    if (filters.stage) {
      const s = options?.stages.find((x) => x.key === filters.stage);
      chips.push({ key: "stage", label: "Stage", value: s?.label || filters.stage });
    }

    if (filters.recruiterId) {
      const r = options?.recruiters.find((x) => x.id === filters.recruiterId);
      chips.push({ key: "recruiterId", label: "Recruiter", value: r?.name || filters.recruiterId });
    }

    return chips;
  }, [filters, options]);

  return (
    <div className="border border-slate-300 bg-white p-3 space-y-3">
      {/* Top Row: Date Range Presets, Custom Pickers, & Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase text-slate-700 mr-2">
            <CalendarIcon className="w-3.5 h-3.5 text-slate-500" />
            <span>Date range:</span>
          </div>

          {(
            [
              { key: "7d", label: "Last 7 Days" },
              { key: "30d", label: "Last 30 Days" },
              { key: "90d", label: "Last 90 Days" },
              { key: "custom", label: "Custom Range" },
            ] as const
          ).map((preset) => {
            const isActive = draftFilters.range === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => handleRangePreset(preset.key)}
                 aria-pressed={isActive}
                 className={`min-h-10 md:min-h-9 px-2.5 py-1 text-sm font-semibold border transition-colors cursor-pointer ${
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

        {/* Action Controls: Apply Filters & Clear Filters */}
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              leftIcon={<RotateCcw className="w-3 h-3 text-slate-500" />}
              className="text-slate-700 hover:text-slate-950 text-sm"
            >
              Clear filters
            </Button>
          )}

          <Button
            variant={hasUnappliedChanges ? "primary" : "secondary"}
            size="sm"
            onClick={handleApply}
            leftIcon={hasUnappliedChanges ? <SlidersHorizontal className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
             className="text-sm font-semibold"
          >
            {hasUnappliedChanges ? "Apply filters" : "Filters applied"}
          </Button>
          {options && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMoreFilters((current) => !current)}
              aria-expanded={showMoreFilters || hasActiveFilters}
              aria-controls="admin-analytics-more-filters"
              className="text-sm"
            >
              {showMoreFilters || hasActiveFilters ? "Hide filters" : "More filters"}
            </Button>
          )}
        </div>
      </div>

      {/* Custom Date Inputs (if custom range selected) */}
      {draftFilters.range === "custom" && (
        <div className="p-2.5 bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-xs font-mono">
            <label htmlFor="analytics-start-date" className="text-slate-600 font-semibold">From</label>
            <input
              type="date"
               id="analytics-start-date"
               value={draftFilters.startDate || ""}
              onChange={(e) =>
                setDraftFilters({ ...draftFilters, range: "custom", startDate: e.target.value })
              }
              className="border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-slate-900 focus:outline-none focus:border-teal-700"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <label htmlFor="analytics-end-date" className="text-slate-600 font-semibold">To</label>
            <input
              type="date"
               id="analytics-end-date"
               value={draftFilters.endDate || ""}
              onChange={(e) =>
                setDraftFilters({ ...draftFilters, range: "custom", endDate: e.target.value })
              }
              className="border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-slate-900 focus:outline-none focus:border-teal-700"
            />
          </div>
        </div>
      )}

      {/* Relational Searchable ComboBox Dropdowns */}
      {options && (showMoreFilters || hasActiveFilters) && (
        <div id="admin-analytics-more-filters" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
          {/* Client Filter (Admin only) */}
          {showClientFilter && options.clients && options.clients.length > 0 && (
            <ComboBox
               label="Client"
              options={clientOptions}
              value={draftFilters.clientId ? String(draftFilters.clientId) : ""}
              onChange={(val) => {
                const clientId = val ? parseInt(val, 10) : undefined;
                setDraftFilters((prev) => {
                  const next = { ...prev, clientId };
                  // If client changed, check if selected MRF belongs to client
                  if (next.mrfId) {
                    const mrfObj = options.mrfs.find((m) => m.id === next.mrfId);
                    if (clientId && mrfObj && mrfObj.clientId !== clientId) {
                      next.mrfId = undefined;
                      next.jobPostingId = undefined;
                    }
                  }
                  return next;
                });
              }}
              placeholder="All Clients"
              clearable={true}
              size="sm"
            />
          )}

          {/* Manpower Request (MRF) Combobox */}
          {options.mrfs && options.mrfs.length > 0 && (
            <ComboBox
               label="Hiring request"
              options={mrfOptions}
              value={draftFilters.mrfId ? String(draftFilters.mrfId) : ""}
              onChange={(val) => {
                const mrfId = val ? parseInt(val, 10) : undefined;
                setDraftFilters((prev) => {
                  const next = { ...prev, mrfId };
                  // Cascading MRF -> Job: if selected Job doesn't belong to newly selected MRF, clear Job
                  if (next.jobPostingId) {
                    const jobObj = options.jobPostings.find((j) => j.id === next.jobPostingId);
                    if (mrfId && jobObj && jobObj.mrfId !== mrfId) {
                      next.jobPostingId = undefined;
                    }
                  }
                  return next;
                });
              }}
               placeholder="All hiring requests"
              clearable={true}
              size="sm"
            />
          )}

          {/* Job Posting / Requisition Combobox (Cascaded from MRF) */}
          {options.jobPostings && options.jobPostings.length > 0 && (
            <ComboBox
               label="Job opening"
              options={jobOptions}
              value={draftFilters.jobPostingId ? String(draftFilters.jobPostingId) : ""}
              onChange={(val) => {
                const jobPostingId = val ? parseInt(val, 10) : undefined;
                setDraftFilters((prev) => ({
                  ...prev,
                  jobPostingId,
                }));
              }}
               placeholder={draftFilters.mrfId ? "Select job opening" : "All job openings"}
              clearable={true}
              size="sm"
            />
          )}

          {/* Recruitment Stage Combobox */}
          {options.stages && options.stages.length > 0 && (
            <ComboBox
               label="Hiring stage"
              options={stageOptions}
              value={draftFilters.stage || ""}
              onChange={(val) => {
                setDraftFilters((prev) => ({
                  ...prev,
                  stage: val || undefined,
                }));
              }}
               placeholder="All hiring stages"
              clearable={true}
              size="sm"
            />
          )}

          {/* Recruiter / TA Specialist Combobox (Admin only) */}
          {showRecruiterFilter && options.recruiters && options.recruiters.length > 0 && (
            <ComboBox
               label="Recruiter"
              options={recruiterOptions}
              value={draftFilters.recruiterId || ""}
              onChange={(val) => {
                setDraftFilters((prev) => ({
                  ...prev,
                  recruiterId: val || undefined,
                }));
              }}
               placeholder="All recruiters"
              clearable={true}
              size="sm"
            />
          )}
        </div>
      )}

      {/* Active Filters Row with Chips and Direct Dismiss */}
      {hasActiveFilters && (
        <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-700 mr-1">
            <Filter className="w-3.5 h-3.5 text-teal-800" />
            <span>Filters applied:</span>
            <span className="px-1.5 py-0.2 bg-teal-100 text-teal-900 text-[10px] border border-teal-300 font-mono font-bold">
              {activeChips.length}
            </span>
          </div>

          {activeChips.map((chip) => (
            <span
              key={chip.key}
              data-testid={`active-filter-chip-${chip.key}`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 text-xs font-mono"
            >
              <span className="text-slate-500 font-bold uppercase text-[10px]">{chip.label}:</span>
              <span className="font-bold text-slate-900 max-w-[200px] truncate">{chip.value}</span>
              <button
                type="button"
                onClick={() => handleRemoveFilter(chip.key)}
                className="hover:text-rose-700 text-slate-400 font-bold ml-0.5 cursor-pointer"
                title={`Remove ${chip.label} filter`}
                aria-label={`Remove ${chip.label} filter`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={handleClearAll}
            className="text-[11px] font-mono text-slate-500 hover:text-rose-700 underline ml-2 cursor-pointer"
          >
             Clear all
          </button>
        </div>
      )}
    </div>
  );
};
