import React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../lib/api/admin.api";
import { taApi } from "../../lib/api/ta.api";
import type { Application } from "../../lib/types/application.types";
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

/** Contact and match details from the same record the full page shows. Row facts above still work if this fails. */
const CandidateProfile: React.FC<{ applicationId: number; viewer: "admin" | "ta" }> = ({ applicationId, viewer }) => {
  const id = String(applicationId);
  const query = useQuery({
    queryKey: [viewer, "application", id],
    queryFn: () => (viewer === "admin" ? adminApi.getApplication(id) : taApi.getApplication(id)),
    staleTime: 30_000,
  });
  const app = query.data as Application | undefined;
  const email = app?.user?.email;
  const phone = app?.user?.applicantProfile?.mobileNumber;
  const score = app ? (app.candidateFitScore ?? app.aiScore) : null;
  const linkCls = "font-medium text-navy underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

  return (
    <section aria-label="Candidate" className="mb-3 border border-slate-200 bg-slate-50 px-3 py-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Candidate</h3>
      {query.isLoading ? (
        <p className="py-2 text-sm text-slate-600">Loading profile…</p>
      ) : query.isError || !app ? (
        <div className="flex flex-wrap items-center gap-3 py-2 text-sm text-slate-800">
          <span role="alert">Could not load the profile.</span>
          <button type="button" onClick={() => query.refetch()} className={`${BUTTON} border-slate-300 bg-white text-slate-700 hover:bg-slate-100`}>
            Retry
          </button>
        </div>
      ) : (
        <dl className="divide-y divide-slate-200">
          <Fact label="Email">{email ? <a href={`mailto:${email}`} className={linkCls}>{email}</a> : "Not provided"}</Fact>
          <Fact label="Phone">{phone ? <a href={`tel:${phone}`} className={linkCls}>{phone}</a> : "Not provided"}</Fact>
          <Fact label="Applied">{formatDate(app.createdAt)}</Fact>
          {score != null && <Fact label="Match score">{Math.round(score)}</Fact>}
        </dl>
      )}
    </section>
  );
};

/** Quick look at one overdue candidate: row facts plus the candidate's contact details, with Previous and Next through the filtered list. No changes are made here. */
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
          <CandidateProfile key={row.applicationId} applicationId={row.applicationId} viewer={viewer} />
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
