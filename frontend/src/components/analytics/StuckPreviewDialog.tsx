import React from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApplicationStatus } from "../../lib/types/enums";
import { formatErrorMessage } from "../../lib/feedback";
import { getApplicationStatusMeta } from "../../lib/utils";
import { deriveApplicationFlags, getStageActions } from "../ta/application/stage-actions";
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
  rows: (StuckCandidate & { daysLeft?: number })[];
  /** Application id of the row being previewed, or null when closed. */
  openId: number | null;
  onSelect: (applicationId: number) => void;
  onClose: () => void;
  viewer: "admin" | "ta";
  showRecruiter: boolean;
  linkState?: Record<string, unknown>;
  /** Opened from a row's "Move stage" button: focus goes straight to the Next step section. */
  focusMove?: boolean;
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

/** The three stage moves the record page runs as a direct update, with the reason it sends when no note is typed. */
const DIRECT_MOVES = {
  "move-to-final": { status: ApplicationStatus.FINAL_INTERVIEW, reason: undefined },
  "move-to-requirements": { status: ApplicationStatus.COMPLIANCE, reason: "Client accepted candidate for employment" },
  "move-to-contract-signing": { status: ApplicationStatus.CONTRACT_SIGNING, reason: "All mandatory clearances verified and approved." },
} as const;

/** Recruiter only. Same stage rules as the record page; moves that need a dialog or schedule stay on the record. */
const NextStep: React.FC<{ applicationId: number; autoFocus?: boolean }> = ({ applicationId, autoFocus }) => {
  const id = String(applicationId);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["ta", "application", id],
    queryFn: () => taApi.getApplication(id),
    staleTime: 30_000,
  });
  const [note, setNote] = React.useState("");
  const [movedTo, setMovedTo] = React.useState<string | null>(null);
  const statusRef = React.useRef<HTMLParagraphElement>(null);
  const sectionRef = React.useRef<HTMLElement>(null);
  const noteRef = React.useRef<HTMLTextAreaElement>(null);

  const move = useMutation({
    mutationFn: (data: { status: ApplicationStatus; reason?: string }) => taApi.updateApplicationStatus(id, data),
    onSuccess: (_, vars) => {
      queryClient.setQueryData<any>(["ta", "application", id], (old: any) => (old ? { ...old, status: vars.status } : old));
      for (const key of ["application", "applications", "analytics", "compliance", "jobs", "deployments", "redeployment-queue"]) {
        queryClient.invalidateQueries({ queryKey: key === "application" ? ["ta", "application", id] : ["ta", key] });
      }
      setNote("");
      setMovedTo(getApplicationStatusMeta(vars.status).label);
    },
  });

  React.useEffect(() => {
    if (movedTo) statusRef.current?.focus();
  }, [movedTo]);

  const loaded = !!query.data;
  React.useEffect(() => {
    if (autoFocus && loaded) (noteRef.current ?? sectionRef.current)?.focus();
  }, [autoFocus, loaded]);

  const app = query.data as Application | undefined;
  if (!app) return null;
  const actions = getStageActions(app, deriveApplicationFlags(app));
  const direct = actions.find((a) => a.id in DIRECT_MOVES);
  const primary = actions.find((a) => a.kind === "primary");
  const pending = actions.find((a) => a.kind === "status");

  return (
    <section ref={sectionRef} tabIndex={-1} aria-label="Next step" className="mb-3 border border-slate-200 px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Next step</h3>
      {movedTo && (
        <p ref={statusRef} tabIndex={-1} role="status" className="py-1 text-sm text-slate-900 focus:outline-none">
          Moved to {movedTo}.
        </p>
      )}
      {direct ? (
        <div className="space-y-2 py-2">
          <label className="block text-xs font-semibold text-slate-600">
            Note (optional)
            <textarea
              ref={noteRef}
              value={note}
              maxLength={500}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 block w-full border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
          </label>
          {move.isError && (
            <p role="alert" className="text-sm text-slate-900">
              {formatErrorMessage(move.error)}
            </p>
          )}
          <button
            type="button"
            disabled={move.isPending}
            onClick={() => {
              const m = DIRECT_MOVES[direct.id as keyof typeof DIRECT_MOVES];
              move.mutate({ status: m.status, reason: note.trim() || m.reason });
            }}
            className={`${BUTTON} border-navy bg-navy text-white hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {move.isPending ? "Moving…" : direct.label}
          </button>
        </div>
      ) : primary ? (
        <p className="py-2 text-sm text-slate-800">Next step: {primary.label}.</p>
      ) : pending ? (
        <p className="py-2 text-sm text-slate-600">{pending.label}</p>
      ) : null}
    </section>
  );
};

/** Quick look at one overdue candidate: row facts plus the candidate's contact details, with Previous and Next through the filtered list. A recruiter can also move the candidate on one stage. */
export const StuckPreviewDialog: React.FC<StuckPreviewDialogProps> = ({ rows, openId, onSelect, onClose, viewer, showRecruiter, linkState, focusMove = false }) => {
  const index = openId === null ? -1 : rows.findIndex((r) => r.applicationId === openId);
  const row = index === -1 ? null : rows[index];
  const admin = viewer === "admin";
  const recruiter = row ? formatRecruiterName(row.recruiterName) : null;
  const linkClass = `${BUTTON} border-navy bg-navy text-white hover:bg-navy/90`;

  return (
    <Dialog open={row !== null} onClose={onClose} size="md" title={row?.candidateName ?? "Candidate"} description={row ? `${row.jobTitle}${row.clientName ? ` · ${row.clientName}` : ""}` : undefined}>
      {row && (
        <>
          <CandidateProfile key={`profile-${row.applicationId}`} applicationId={row.applicationId} viewer={viewer} />
          {!admin && <NextStep key={`next-${row.applicationId}`} applicationId={row.applicationId} autoFocus={focusMove} />}
          <dl className="divide-y divide-slate-200">
            <Fact label="Stage">{row.stageLabel}</Fact>
            <Fact label="In this stage">
              {row.daysInStage} of {row.slaDays} {row.slaDays === 1 ? "day" : "days"} allowed
            </Fact>
            {row.daysLeft !== undefined ? (
              <Fact label="Due">
                {row.daysLeft === 0 ? "Today" : `In ${row.daysLeft} ${row.daysLeft === 1 ? "day" : "days"}`}
                {row.estimated && <span className="text-slate-600"> · estimated from application date</span>}
              </Fact>
            ) : (
              <>
                <Fact label="Over by">
                  {row.daysOver} {row.daysOver === 1 ? "day" : "days"}
                </Fact>
                <Fact label="Urgency">
                  {row.urgency === "critical" ? "Critical" : "Overdue"}
                  {row.estimated && <span className="text-slate-600"> · estimated from application date</span>}
                </Fact>
              </>
            )}
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
