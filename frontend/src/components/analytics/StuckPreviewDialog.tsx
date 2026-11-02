import React from "react";
import { Link } from "@tanstack/react-router";
import type { StuckCandidate } from "../../lib/types/analytics.types";
import { daysAgoText } from "../../lib/analytics-format";
import { formatRecruiterName } from "../../lib/recruiter-label";
import { formatDate } from "../../lib/utils";
import { Dialog } from "../ui/Dialog";

interface StuckPreviewDialogProps {
  /** The currently filtered list, so Previous and Next step through what the person sees. */
  rows: StuckCandidate[];
  /** Application id of the row being previewed, or null when closed. */
  openId: number | null;
  onSelect: (applicationId: number) => void;
  onClose: () => void;
  viewer: "admin" | "ta";
  showRecruiter: boolean;
  linkState?: Record<string, unknown>;
}

const BUTTON =
  "inline-flex min-h-11 items-center justify-center border px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:min-h-9";

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 py-1.5 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
    <dt className="text-xs font-semibold text-slate-600">{label}</dt>
    <dd className="min-w-0 break-words text-slate-900">{children}</dd>
  </div>
);

/** Read-only look at one overdue candidate, with Previous and Next through the filtered list. No changes are made here. */
export const StuckPreviewDialog: React.FC<StuckPreviewDialogProps> = ({ rows, openId, onSelect, onClose, viewer, showRecruiter, linkState }) => {
  const index = openId === null ? -1 : rows.findIndex((r) => r.applicationId === openId);
  const row = index === -1 ? null : rows[index];
  const admin = viewer === "admin";
  const recruiter = row ? formatRecruiterName(row.recruiterName) : null;
  const linkClass = `${BUTTON} border-navy bg-navy text-white hover:bg-navy/90`;

  return (
    <Dialog open={row !== null} onClose={onClose} size="md" title={row?.candidateName ?? "Candidate"} description={row ? `${row.jobTitle}${row.clientName ? ` · ${row.clientName}` : ""}` : undefined}>
      {row && (
        <>
          <dl className="divide-y divide-slate-200">
            <Fact label="Stage">{row.stageLabel}</Fact>
            <Fact label="In this stage">
              {row.daysInStage} of {row.slaDays} {row.slaDays === 1 ? "day" : "days"} allowed
            </Fact>
            <Fact label="Over by">
              {row.daysOver} {row.daysOver === 1 ? "day" : "days"}
            </Fact>
            <Fact label="Urgency">
              {row.urgency === "critical" ? "Critical" : "Overdue"}
              {row.estimated && <span className="text-slate-600"> · estimated from application date</span>}
            </Fact>
            {showRecruiter && recruiter && <Fact label="Recruiter">{recruiter.full ?? recruiter.label}</Fact>}
            <Fact label="Last activity">
              {row.lastActivityAt ? (
                <>
                  {daysAgoText(row.lastActivityAt)} <span className="text-slate-600">· {formatDate(row.lastActivityAt)}</span>
                </>

              ) : (
                "None recorded"
              )}
            </Fact>
            <Fact label="Last note">{row.lastNote ?? "No note"}</Fact>
          </dl>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-slate-200 pt-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={index <= 0}
                onClick={() => onSelect(rows[index - 1].applicationId)}
                className={`${BUTTON} border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Previous
              </button>
              <span className="text-xs tabular-nums text-slate-600" aria-live="polite">
                {index + 1} of {rows.length}
              </span>
              <button
                type="button"
                disabled={index >= rows.length - 1}
                onClick={() => onSelect(rows[index + 1].applicationId)}
                className={`${BUTTON} border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Next
              </button>
            </div>
            {admin ? (
              <Link
                to="/admin/applications/$applicationId"
                params={{ applicationId: String(row.applicationId) }}
                {...(linkState ? { state: linkState as never } : {})}
                className={linkClass}
              >
                Open record
              </Link>
            ) : (
              <Link to="/ta/applications/$applicationId" params={{ applicationId: String(row.applicationId) }} className={linkClass}>
                Open record
              </Link>
            )}
          </div>
        </>
      )}
    </Dialog>
  );
};
