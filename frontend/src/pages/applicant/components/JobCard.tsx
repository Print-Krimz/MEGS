import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Bookmark, Building2, MapPin } from "lucide-react";
import type { JobPosting } from "../../../lib/api/applicant-jobs.api";
import { JobImage } from "../../../components/common";
import { WORK_SHIFT_LABELS, type WorkShift } from "../../../lib/mrf-schedule";
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
  /** Why this job was recommended. Shown as one line under the job terms. */
  reasons?: string[];
  /** When set, shows a "Not interested" button that hides the job from recommendations. */
  onDismiss?: (jobId: number) => void;
}

/** The place the person would work: the posting's own location, else the requisition's. */
export const jobWorksite = (job: JobPosting): string | null =>
  job.location?.trim() || job.mrf?.location?.trim() || null;

const hasSalary = (job: JobPosting): boolean =>
  Boolean((job.mrf?.salaryRangeMin ?? 0) > 0 || (job.mrf?.salaryRangeMax ?? 0) > 0);

const BULLET = /^([-*•–—]|\d+[.)])\s+/;
const LABEL_VALUE = /^[A-Za-z][A-Za-z &/]{1,28}:\s+\S/;
const isHeadingLine = (line: string) =>
  /^#{1,6}\s/.test(line) ||
  /^\*\*[^*]+\*\*:?$/.test(line) ||
  line.endsWith(":") ||
  (line.length <= 40 && line.split(/\s+/).length <= 5 && !/[.!?]$/.test(line));

const stripInlineMarkdown = (line: string): string =>
  line
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .trim();

/** The opening paragraph of a posting, without its section heading, bullets or "Label: value" lines. */
export const firstParagraph = (description?: string | null): string => {
  const lines = (description ?? "").split(/\r?\n/);
  // A one-line description is the whole summary, even if it looks like a heading.
  const nonEmpty = lines.map((line) => line.trim()).filter(Boolean);
  if (nonEmpty.length === 1) return stripInlineMarkdown(nonEmpty[0]);
  const paragraph: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const isProse = line !== "" && !BULLET.test(line) && !LABEL_VALUE.test(line) && !isHeadingLine(line);
    if (isProse) paragraph.push(stripInlineMarkdown(line));
    else if (paragraph.length > 0) break;
  }
  return paragraph.join(" ");
};

export const JobCard: React.FC<JobCardProps> = ({ job, saved, saveDisabled = false, onToggleSave, reasons, onDismiss }) => {
  const worksite = jobWorksite(job);
  const summary = firstParagraph(job.description);
  const client = job.mrf?.client;
  const terms = [
    job.mrf?.employmentType ? formatEmploymentType(job.mrf.employmentType) : null,
    job.mrf?.workArrangement ? formatWorkArrangement(job.mrf.workArrangement) : null,
    job.mrf?.workShift ? WORK_SHIFT_LABELS[job.mrf.workShift as WorkShift] ?? null : null,
    job.mrf?.department || null,
  ].filter((term): term is string => Boolean(term));

  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {job.imageUrl && <JobImage src={job.imageUrl} title={job.title} alt={job.title} size="md" />}
          <div className="min-w-0 space-y-1">
            <h3 className="text-base sm:text-lg font-semibold leading-snug tracking-tight text-[#0B315D]">
              <Link
                to="/app/jobs/$jobId"
                params={{ jobId: String(job.id) }}
                className="flex min-h-11 items-center rounded-sm sm:inline sm:min-h-0 applicant-touch:inline-flex applicant-touch:min-h-11 applicant-touch:items-center hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
              >
                {job.title}
              </Link>
            </h3>
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
                : "border-slate-200 bg-white text-slate-600 hover:bg-navy-soft hover:text-navy",
          )}
        >
          <Bookmark className={cn("size-4", saved && "fill-navy")} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
        <span className="inline-flex items-center gap-1.5 text-slate-700 min-w-0">
          <MapPin className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
          <span className="min-w-0 break-words">{worksite ?? "To be confirmed"}</span>
        </span>
        <span className="text-slate-300" aria-hidden="true">·</span>
        {hasSalary(job) ? (
          <span className="font-semibold tabular-nums text-slate-900">
            {formatSalaryRange(job.mrf?.salaryRangeMin, job.mrf?.salaryRangeMax)}
          </span>
        ) : (
          <span className="text-slate-500">Not stated</span>
        )}
      </div>

      {terms.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Job terms">
          {terms.map((term) => (
            <span
              key={term}
              className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
            >
              {term}
            </span>
          ))}
        </div>
      )}

      {reasons && reasons.length > 0 && <p className="mt-3 text-sm font-medium text-navy">{reasons.join(" · ")}</p>}

      {summary && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">{summary}</p>}

      <div className="mt-auto pt-5">
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <div className="flex flex-col items-start">
            <span className="text-xs text-slate-500">Posted {formatDate(job.createdAt)}</span>
            {onDismiss && (
              <button
                type="button"
                onClick={() => onDismiss(job.id)}
                aria-label={`Not interested in ${job.title}`}
                className="-ml-2 min-h-11 rounded-md px-2 text-sm font-medium text-slate-700 underline-offset-4 hover:bg-navy-soft hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                Not interested
              </button>
            )}
          </div>
          <Link
            to="/app/jobs/$jobId"
            params={{ jobId: String(job.id) }}
            aria-label={`View & Apply for ${job.title}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-[#0B315D] transition-colors hover:border-[#0B315D] hover:bg-[#0B315D] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            <span>View &amp; Apply</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
};
