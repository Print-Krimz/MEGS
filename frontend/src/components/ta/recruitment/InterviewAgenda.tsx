import React from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "../../ui";
import { SelectBox } from "../../common/SelectBox";
import { formatDate } from "../../../lib/utils";
import { formatInterviewDeadlineStatus, TA_COPY } from "../../../lib/ta-copy";

export interface AgendaInterview {
  interviewId: number;
  applicationId: number;
  candidateName: string;
  jobTitle: string;
  currentStage: string;
  scheduledAt: string;
  deadline: string;
  status: string;
}

type Bucket = "BREACHED" | "WARNING" | "HEALTHY";

const BUCKET_LABELS: Record<Bucket, string> = {
  BREACHED: "Overdue",
  WARNING: "Due within 48 hours",
  HEALTHY: "On track",
};
const BUCKET_ORDER: Bucket[] = ["BREACHED", "WARNING", "HEALTHY"];

export const interviewStageLabel = (stage: string) =>
  stage === "FINAL_INTERVIEW" ? "Final interview" : "Initial screening";

const chipClass = (status: string) =>
  status === "BREACHED"
    ? "border-rose-200 bg-rose-50 text-rose-800"
    : status === "WARNING"
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : "border-emerald-200 bg-emerald-50 text-emerald-800";

const formatTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(date);
};

export interface AgendaSelection {
  selectedIds: ReadonlySet<string>;
  onToggle: (interviewId: number) => void;
}

interface InterviewAgendaProps {
  rows: AgendaInterview[];
  onRecord: (row: AgendaInterview) => void;
  /** Adds a checkbox to each row for bulk actions. */
  selection?: AgendaSelection;
}

/** Interviews awaiting an outcome, grouped by their deadline status (same as the chips and tiles). Only the first overdue row is a solid button. */
export const InterviewAgenda: React.FC<InterviewAgendaProps> = ({ rows, onRecord, selection }) => {
  const byDeadline = (a: AgendaInterview, b: AgendaInterview) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  const groups = BUCKET_ORDER.map((bucket) => ({
    bucket,
    items: rows.filter((row) => row.status === bucket).sort(byDeadline),
  })).filter((group) => group.items.length > 0);
  const firstOverdueId = groups.find((g) => g.bucket === "BREACHED")?.items[0]?.interviewId;

  return (
    <div className="space-y-5">
      {groups.map(({ bucket, items }) => (
        <section key={bucket} aria-labelledby={`agenda-${bucket}`}>
          <h3 id={`agenda-${bucket}`} className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-slate-950">
            {BUCKET_LABELS[bucket]}
            <span className="text-xs font-medium tabular-nums text-slate-600">{items.length}</span>
          </h3>
          <ul className="divide-y divide-slate-200 rounded-md border border-slate-300 bg-white">
            {items.map((row) => (
              <li key={row.interviewId} className={selection ? "flex items-start gap-1 pl-2 md:items-center" : undefined}>
                {selection && (
                  <SelectBox
                    checked={selection.selectedIds.has(String(row.interviewId))}
                    label={`Select ${row.candidateName}`}
                    onChange={() => selection.onToggle(row.interviewId)}
                  />
                )}
                <div className="grid min-w-0 flex-1 gap-x-4 gap-y-1 px-4 py-2.5 md:grid-cols-[8.5rem_minmax(0,1.2fr)_minmax(0,1fr)_16rem_9.5rem] md:items-center">
                <time dateTime={row.scheduledAt} className="text-sm tabular-nums text-slate-700">
                  <span className="block font-medium text-slate-900">{formatDate(row.scheduledAt)}</span>
                  <span className="text-xs text-slate-600">{formatTime(row.scheduledAt)}</span>
                </time>
                <div className="min-w-0">
                  <Link
                    to="/ta/applications/$applicationId"
                    params={{ applicationId: String(row.applicationId) }}
                    className="inline-flex min-h-11 items-center font-medium text-navy underline-offset-2 hover:underline focus-ring md:min-h-0"
                  >
                    {row.candidateName}
                  </Link>
                  <p className="text-sm text-slate-600 md:hidden">
                    {interviewStageLabel(row.currentStage)} · {row.jobTitle}
                  </p>
                </div>
                <p className="hidden min-w-0 text-sm text-slate-700 md:block">
                  <span className="block truncate text-slate-900">{row.jobTitle}</span>
                  <span className="text-xs text-slate-600">{interviewStageLabel(row.currentStage)}</span>
                </p>
                <span
                  className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold ${chipClass(row.status)}`}
                >
                  {formatInterviewDeadlineStatus(row.status)}
                  <span className="font-normal">· {formatDate(row.deadline)}</span>
                </span>
                <Button
                  variant={row.interviewId === firstOverdueId ? "primary" : "outline"}
                  size="sm"
                  className="mt-1 w-full md:mt-0 md:w-auto"
                  aria-label={`${TA_COPY.interviews.recordOutcome} for ${row.candidateName}`}
                  onClick={() => onRecord(row)}
                >
                  {TA_COPY.interviews.recordOutcome}
                </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
