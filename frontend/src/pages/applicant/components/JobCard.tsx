import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Bookmark, Building2, MapPin } from "lucide-react";
import type { JobPosting } from "../../../lib/api/applicant-jobs.api";
import { JobImage } from "../../../components/common";
import {
  cn,
  formatDate,
  formatEmploymentType,
  formatSalaryRange,
  formatWorkArrangement,
} from "../../../lib/utils";

interface JobCardProps {
  job: JobPosting;
  saved: boolean;
  /** True when the applicant is at the saved-jobs cap, so an unsaved job cannot be bookmarked. */
  saveDisabled?: boolean;
  onToggleSave: (jobId: number) => void;
}

/** The place the person would work: the posting's own location, else the requisition's. */
export const jobWorksite = (job: JobPosting): string | null =>
  job.location?.trim() || job.mrf?.location?.trim() || null;

const hasSalary = (job: JobPosting): boolean =>
  Boolean((job.mrf?.salaryRangeMin ?? 0) > 0 || (job.mrf?.salaryRangeMax ?? 0) > 0);

export const JobCard: React.FC<JobCardProps> = ({ job, saved, saveDisabled = false, onToggleSave }) => {
  const worksite = jobWorksite(job);
  const client = job.mrf?.client;
  const terms = [
    job.mrf?.employmentType ? formatEmploymentType(job.mrf.employmentType) : null,
    job.mrf?.workArrangement ? formatWorkArrangement(job.mrf.workArrangement) : null,
  ].filter(Boolean);

  return (
    <article className="flex h-full flex-col rounded-lg border border-slate-300 bg-white p-5 transition-colors hover:border-navy/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {job.imageUrl && (
            <div className="mb-2">
              <JobImage src={job.imageUrl} title={job.title} alt={job.title} size="md" />
            </div>
          )}
          <h3 className="text-lg font-bold leading-snug tracking-tight text-navy">{job.title}</h3>
          {client?.name && (
            <p className="flex items-center gap-1.5 text-sm text-slate-600">
              <Building2 className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="font-medium text-slate-900">{client.name}</span>
                {client.industry && <span> · {client.industry}</span>}
              </span>
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label={saved ? `Remove ${job.title} from saved jobs` : `Save ${job.title} for later`}
          aria-pressed={saved}
          aria-disabled={saveDisabled && !saved}
          title={saveDisabled && !saved ? "Saved jobs limit reached. Remove one to save another." : undefined}
          onClick={() => onToggleSave(job.id)}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1",
            saved
              ? "border-navy/40 bg-navy-soft text-navy hover:bg-navy-line"
              : saveDisabled
                ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                : "border-slate-300 bg-white text-slate-600 hover:bg-navy-soft hover:text-navy",
          )}
        >
          <Bookmark className={cn("size-4", saved && "fill-navy")} aria-hidden="true" />
        </button>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-600">Worksite</dt>
          <dd className="mt-0.5 flex items-start gap-1.5 text-slate-900">
            <MapPin className="mt-0.5 size-4 shrink-0 text-slate-600" aria-hidden="true" />
            <span className="min-w-0 break-words">{worksite ?? "To be confirmed"}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-600">Salary</dt>
          <dd className="mt-0.5">
            {hasSalary(job) ? (
              <span className="font-semibold text-slate-900">
                {formatSalaryRange(job.mrf?.salaryRangeMin, job.mrf?.salaryRangeMax)}
              </span>
            ) : (
              <span className="text-slate-600">Not stated</span>
            )}
          </dd>
        </div>
      </dl>

      {terms.length > 0 && <p className="mt-3 text-sm text-slate-600">{terms.join(" · ")}</p>}

      {job.description && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">{job.description}</p>
      )}

      <div className="mt-auto pt-5">
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <span className="text-xs text-slate-600">Posted {formatDate(job.createdAt)}</span>
          <Link
            to="/app/jobs/$jobId"
            params={{ jobId: String(job.id) }}
            aria-label={`View details for ${job.title}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-navy px-4 text-sm font-medium text-white transition-colors hover:bg-navy-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            <span>View details</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
};
