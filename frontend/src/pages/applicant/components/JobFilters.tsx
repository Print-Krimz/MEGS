import React, { useId } from "react";
import { Search, X } from "lucide-react";
import { ComboBox, Input } from "../../../components/ui";
import { JOB_LOCATION_OPTIONS } from "../../../lib/job-locations";

export interface JobFilterValues {
  search: string;
  location: string;
  salaryMin: string;
  salaryMax: string;
}

interface JobFiltersProps {
  values: JobFilterValues;
  onChange: (patch: Partial<JobFilterValues>) => void;
  /** Shown under the salary fields when the range is backwards. */
  salaryError?: string;
}

/** Search, worksite and monthly salary range for the applicant job list. */
export const JobFilters: React.FC<JobFiltersProps> = ({ values, onChange, salaryError }) => {
  const id = useId();
  const searchId = `${id}-search`;
  const locationId = `${id}-location`;
  const salaryErrorId = `${id}-salary-error`;

  return (
    <div role="search" aria-label="Search and filter jobs" className="rounded-lg border border-slate-300 bg-white p-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.7fr)]">
        <Input
          id={searchId}
          label="Search"
          type="text"
          placeholder="Job title, skill or keyword"
          value={values.search}
          onChange={(event) => onChange({ search: event.target.value })}
          leftIcon={<Search className="size-4" aria-hidden="true" />}
          rightIcon={
            values.search ? (
              <button
                type="button"
                onClick={() => onChange({ search: "" })}
                aria-label="Clear search"
                className="p-1 text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : undefined
          }
        />

        <ComboBox
          id={locationId}
          label="Worksite"
          placeholder="Any location"
          options={JOB_LOCATION_OPTIONS}
          value={values.location}
          onChange={(location) => onChange({ location })}
          clearable={Boolean(values.location)}
          emptyText="No matching location"
        />

        <Input
          label="Min salary per month"
          type="number"
          min={0}
          max={1000000}
          step={500}
          placeholder="0"
          value={values.salaryMin}
          aria-invalid={salaryError ? true : undefined}
          aria-describedby={salaryError ? salaryErrorId : undefined}
          className={salaryError ? "border-rose-400" : undefined}
          onChange={(event) => onChange({ salaryMin: event.target.value })}
          leftIcon={<span aria-hidden="true">₱</span>}
        />

        <Input
          label="Max salary per month"
          type="number"
          min={0}
          max={1000000}
          step={500}
          placeholder="No limit"
          value={values.salaryMax}
          aria-invalid={salaryError ? true : undefined}
          aria-describedby={salaryError ? salaryErrorId : undefined}
          className={salaryError ? "border-rose-400" : undefined}
          onChange={(event) => onChange({ salaryMax: event.target.value })}
          leftIcon={<span aria-hidden="true">₱</span>}
        />
      </div>

      {salaryError && (
        <p id={salaryErrorId} role="alert" className="mt-2 text-sm font-medium text-rose-700">
          {salaryError}
        </p>
      )}
    </div>
  );
};
