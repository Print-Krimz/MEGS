import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { taApi } from "../../../lib/api/ta.api";
import { ErrorState, ScoreBadge, StatusBadge } from "../../common";
import { Button } from "../../ui";
import { cn, displayEmail, formatDate } from "../../../lib/utils";
import { ApplicationStatus, InterviewType } from "../../../lib/types/enums";
import type { TAApplicationSummary } from "../../../lib/types/application.types";
import type { TAApplicationSearch } from "../../../routes";
import { HEALTH_CHIP } from "../../../lib/chart-palette";
import { stageHealth, stageLimitDays } from "../../../lib/stage-limits";
import { getManilaToday } from "../../../lib/field-limits";
import { deriveApplicationFlags, pickStageBarActions } from "../application/stage-actions";
import { getNextStep } from "../application/next-step";
import { useApplicationMutations } from "../application/useApplicationMutations";
import { useIsDesktop } from "../application/useIsDesktop";
import { MatchBreakdown, type ScoreExplanation } from "../application/MatchBreakdown";
import { ScheduleInterviewDialog } from "../application/ScheduleInterviewDialog";
import { CloseApplicationDialog } from "../CloseApplicationDialog";
import { InterviewOutcomeDialog } from "../InterviewOutcomeDialog";
import { ResumeDrawerButton } from "../application/ResumePanel";
import { SourceChip } from "../walk-in/SourceChip";
import { summarizeInterview } from "../application/summary";
import { CandidateSnapshot, HiringProgress, OtherApplications } from "./ReviewPanelDetails";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

const scoreOf = (app: TAApplicationSummary) => {
  const score = app.candidateFitScore ?? app.aiScore;
  return score == null ? undefined : Math.round(score);
};

const PENDING_REVIEW: string[] = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.PARSING,
  ApplicationStatus.REVIEW,
  ApplicationStatus.MATCHED,
  ApplicationStatus.NEEDS_ATTENTION,
];
const CLOSED: string[] = [
  ApplicationStatus.REJECTED,
  ApplicationStatus.BACKOUT,
  ApplicationStatus.TALENT_POOL,
  ApplicationStatus.ARCHIVED,
];

/** Where the candidate is in the recruiter's review: not yet looked at, moving through hiring, or closed. */
export const reviewStateOf = (app: Pick<TAApplicationSummary, "status" | "isArchived">) =>
  app.isArchived || CLOSED.includes(app.status)
    ? { label: "Closed", className: "border-slate-300 bg-slate-100 text-slate-700" }
    : PENDING_REVIEW.includes(app.status)
    ? { label: "Pending review", className: "border-navy bg-white text-navy" }
    : { label: "Reviewed", className: "border-slate-300 bg-white text-slate-700" };

const daysLabel = (days?: number) => (days == null ? "-" : days <= 0 ? "Today" : days === 1 ? "1 day" : `${days} days`);

/** Only late candidates get a chip, so they stand out; on track needs no label. */
const HealthChip: React.FC<{ status: ApplicationStatus; days?: number }> = ({ status, days }) => {
  const health = stageHealth(status, days);
  if (health !== "overdue") return null;
  const chip = HEALTH_CHIP[health];
  const limit = stageLimitDays(status);
  return (
    <span
      title={limit ? `Stage limit: ${limit} days` : undefined}
      className={cn("inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium", chip.className)}
    >
      {chip.label}
    </span>
  );
};

const Avatar: React.FC<{ name: string; photoUrl?: string | null; size?: "sm" | "md" }> = ({ name, photoUrl, size = "sm" }) => {
  const box = size === "md" ? "h-12 w-12 text-base" : "h-9 w-9 text-xs";
  return photoUrl ? (
    <img src={photoUrl} alt="" className={cn("shrink-0 rounded-full border border-slate-300 object-cover", box)} />
  ) : (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-navy-soft font-semibold text-navy", box)}
    >
      {initialsOf(name)}
    </span>
  );
};

type ScheduleKind = typeof InterviewType.INITIAL_SCREENING | typeof InterviewType.FINAL_INTERVIEW;

interface ReviewPanelProps {
  /** The list row: carries days in stage and returning-worker details the record endpoint does not compute. */
  row: TAApplicationSummary;
  listSearch: TAApplicationSearch;
  /** Called after a reject or a scheduled interview so the queue can move to the next candidate. */
  onDone: () => void;
}

/** The selected candidate: who, where they stand, what is next, and the two actions a recruiter takes most. */
const ReviewPanel: React.FC<ReviewPanelProps> = ({ row, listSearch, onDone }) => {
  const id = String(row.id);
  const daysInStage = row.daysInStage;
  const query = useQuery({
    queryKey: ["ta", "application", id],
    queryFn: () => taApi.getApplication(id),
  });
  const app = query.data;
  const profile = app?.user?.applicantProfile;
  const candidateName =
    (profile ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() : "") || displayEmail(app?.user?.email) || "Candidate";
  const m = useApplicationMutations({ applicationId: id, status: app?.status, candidateName });
  const [schedule, setSchedule] = useState<ScheduleKind | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);

  if (query.isPending) {
    return (
      <div role="status" aria-label="Loading candidate" className="space-y-3 p-5 motion-safe:animate-pulse">
        <div className="h-12 w-1/2 bg-slate-200" />
        <div className="h-4 w-3/4 bg-slate-100" />
        <div className="h-24 bg-slate-100" />
      </div>
    );
  }
  if (query.isError || !app) {
    return (
      <div className="p-5">
        <ErrorState compact subject="this application" error={query.error as Error} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  const flags = deriveApplicationFlags(app);
  const next = getNextStep(app, flags);
  const { primary } = pickStageBarActions(app, flags);
  const scheduleType: ScheduleKind | null =
    primary?.id === "schedule-initial"
      ? InterviewType.INITIAL_SCREENING
      : primary?.id === "schedule-final"
      ? InterviewType.FINAL_INTERVIEW
      : null;
  const outcomeInterview =
    primary?.id === "record-initial-outcome"
      ? flags.pendingScreeningInterview
      : primary?.id === "record-final-outcome"
      ? flags.pendingFinalInterview
      : null;
  // Actions the panel can finish itself; anything else opens the record.
  // Recording needs the pending interview; without it the record page is the safe place to act.
  const inlineAction: { run: () => void } | null = scheduleType
    ? { run: () => setSchedule(scheduleType) }
    : outcomeInterview
    ? { run: () => setOutcomeOpen(true) }
    : null;
  const canReject = flags.canReject && app.status !== ApplicationStatus.DEPLOYED;

  const scores = app.candidateScores?.[0];
  const fitScore = scores?.finalFitScore ?? app.candidateFitScore ?? app.aiScore;
  const explanation = (() => {
    if (!scores?.explanation) return null;
    try {
      const parsed = typeof scores.explanation === "string" ? JSON.parse(scores.explanation) : scores.explanation;
      return parsed && typeof parsed === "object" ? (parsed as ScoreExplanation) : null;
    } catch {
      return null;
    }
  })();
  const requirementsResult = flags.totalCompReqs > 0 ? { approved: flags.approvedCompReqs, total: flags.totalCompReqs } : null;
  const clientName = app.jobPosting?.mrf?.client?.name;
  const email = displayEmail(app.user?.email);
  const matchedSkills = explanation?.dimensionExplanations?.SKILLS?.matched ?? [];
  const resumeUrl = profile?.resumeUrl || app.resumeUrl;
  const returning = row.returning;

  const recordLink = (variant: "primary" | "outline") => (
    <Button asChild variant={variant} size="sm" className="min-h-11 md:min-h-9">
      <Link to="/ta/applications/$applicationId" params={{ applicationId: id }} search={listSearch}>
        Open record
      </Link>
    </Button>
  );

  return (
    <article aria-labelledby="review-panel-name" className="space-y-5 p-5">
      <header className="flex items-start gap-3">
        <Avatar name={candidateName} photoUrl={profile?.photoUrl} size="md" />
        <div className="min-w-0 flex-1">
          <h2 id="review-panel-name" className="break-words font-display text-xl font-semibold text-slate-950">
            {candidateName}
          </h2>
          <p className="break-words text-sm text-slate-600">
            {app.jobPosting?.title || "Job opening"}
            {clientName ? ` · ${clientName}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={app.status} />
            <HealthChip status={app.status} days={daysInStage} />
            <SourceChip source={app.source} />
            {returning && (
              <span className="inline-flex items-center rounded border border-navy-line bg-navy-soft px-1.5 py-0.5 text-xs font-medium text-navy">
                {returning.sameClient ? "Redeployment" : "Previously deployed"} · {returning.clientName}
              </span>
            )}
          </div>
        </div>
        <ScoreBadge score={fitScore == null ? undefined : Math.round(Number(fitScore))} />
      </header>

      {/* The action button already says what is next; plain text only when the next step is not a button here. */}
      {!inlineAction && next.text && <p className="text-sm text-slate-700">{next.text}</p>}

      <div className="flex flex-wrap gap-2">
        {inlineAction ? (
          <>
            <Button size="sm" className="min-h-11 md:min-h-9" onClick={inlineAction.run}>
              {primary?.label}
            </Button>
            {recordLink("outline")}
          </>
        ) : (
          recordLink("primary")
        )}
        {(resumeUrl?.trim() || profile) && (
          <ResumeDrawerButton
            open={resumeOpen}
            onOpenChange={setResumeOpen}
            resumeUrl={resumeUrl}
            candidateName={candidateName}
            megs={profile ? { profile, email, reference: app.trackingCode } : undefined}
            onFullscreen={() => {
              if (resumeUrl) window.open(resumeUrl, "_blank", "noopener,noreferrer");
            }}
          />
        )}
        {canReject && (
          <Button variant="ghost" size="sm" className="min-h-11 md:ml-auto md:min-h-9" onClick={() => setRejectOpen(true)}>
            Reject
          </Button>
        )}
      </div>

      {(app.interviews?.length ?? 0) > 0 && (
        <p className="text-sm text-slate-900">
          <span className="text-slate-600">Interview: </span>
          {summarizeInterview(app.interviews ?? [], Date.now())}
        </p>
      )}

      <CandidateSnapshot app={app} email={email} matchedSkills={matchedSkills} />

      <HiringProgress app={app} flags={flags} daysText={daysLabel(daysInStage)} limitDays={stageLimitDays(app.status)} />

      <MatchBreakdown scores={scores ?? null} explanation={explanation} requirementsResult={requirementsResult} />

      <OtherApplications app={app} email={email} listSearch={listSearch} />

      <ScheduleInterviewDialog
        open={schedule != null}
        onClose={() => setSchedule(null)}
        candidateName={candidateName}
        candidateEmail={email}
        candidateMobile={profile?.mobileNumber}
        type={schedule ?? InterviewType.INITIAL_SCREENING}
        isReschedule={false}
        isSubmitting={m.scheduleInterview.isPending}
        onSubmit={(values) =>
          m.scheduleInterview.mutate(
            { ...values, type: values.type as ScheduleKind },
            {
              onSuccess: () => {
                setSchedule(null);
                onDone();
              },
            }
          )
        }
      />
      <InterviewOutcomeDialog
        open={outcomeOpen}
        onClose={() => setOutcomeOpen(false)}
        candidateName={candidateName}
        jobTitle={app.jobPosting?.title}
        isFinalInterview={primary?.id === "record-final-outcome"}
        scheduledAt={outcomeInterview?.scheduledAt}
        isSubmitting={m.updateInterviewStatus.isPending}
        onSubmit={({ result, notes }) =>
          m.updateInterviewStatus.mutate(
            {
              interviewId: outcomeInterview?.id,
              type: primary?.id === "record-final-outcome" ? InterviewType.FINAL_INTERVIEW : InterviewType.INITIAL_SCREENING,
              result,
              notes,
            },
            {
              onSuccess: () => {
                setOutcomeOpen(false);
                onDone();
              },
            }
          )
        }
      />
      <CloseApplicationDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onSubmit={(data) =>
          m.close.mutate(data, {
            onSuccess: () => {
              setRejectOpen(false);
              onDone();
            },
          })
        }
        loading={m.close.isPending}
        outcome="REJECTED"
        stage={app.status}
        candidateName={candidateName}
        applicationCreatedOn={app.createdAt ? getManilaToday(new Date(app.createdAt)) : undefined}
      />
    </article>
  );
};

export interface ReviewQueueProps {
  rows: TAApplicationSummary[];
  nameOf: (app: TAApplicationSummary) => string;
  nextStepOf: (app: TAApplicationSummary) => string;
  listSearch: TAApplicationSearch;
  isFetching?: boolean;
  empty: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Split view of the current list: candidates on the left, the selected one on the right.
 * Arrow keys move through the list. Below 1024px there is no room for the panel, so a row opens the record.
 */
export const ReviewQueue: React.FC<ReviewQueueProps> = ({ rows, nameOf, nextStepOf, listSearch, isFetching, empty, footer }) => {
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<number | null>(rows[0]?.id ?? null);
  const listRef = useRef<HTMLUListElement>(null);
  // Index of the row that was acted on, so the queue moves to whoever takes its place after the refresh.
  const advanceFrom = useRef<number | null>(null);

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedId(null);
      return;
    }
    if (advanceFrom.current != null) {
      const index = Math.min(advanceFrom.current, rows.length - 1);
      advanceFrom.current = null;
      setSelectedId(rows[index].id);
      return;
    }
    if (selectedId == null || !rows.some((row) => row.id === selectedId)) setSelectedId(rows[0].id);
  }, [rows, selectedId]);

  const open = (app: TAApplicationSummary) => {
    if (isDesktop) setSelectedId(app.id);
    else void navigate({ to: "/ta/applications/$applicationId", params: { applicationId: String(app.id) }, search: listSearch });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-row]") ?? []);
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    const target = buttons[Math.max(0, Math.min(buttons.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)))];
    target.focus();
    if (isDesktop) setSelectedId(Number(target.dataset.row));
  };

  const onDone = () => {
    const index = rows.findIndex((row) => row.id === selectedId);
    advanceFrom.current = index < 0 ? 0 : index;
  };

  if (rows.length === 0) return <div className="rounded-md border border-slate-300 bg-white">{empty}</div>;

  // Same person applied to the same opening more than once on this page: flag it so it does not read as a glitch.
  const keyOf = (app: TAApplicationSummary) => (app.user?.id && app.jobPosting?.id ? `${app.user.id}:${app.jobPosting.id}` : null);
  const seen = new Map<string, number>();
  rows.forEach((app) => {
    const key = keyOf(app);
    if (key) seen.set(key, (seen.get(key) ?? 0) + 1);
  });
  const isRepeat = (app: TAApplicationSummary) => {
    const key = keyOf(app);
    return key != null && (seen.get(key) ?? 0) > 1;
  };

  // Each column scrolls on its own and stops at what is left of the window.
  const columnHeight = "lg:max-h-[calc(100dvh-9rem)]";

  return (
    <div className="overflow-hidden rounded-md border border-slate-300 bg-white" aria-busy={isFetching || undefined}>
      <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className={cn("border-slate-300 lg:overflow-y-auto lg:border-r", columnHeight)}>
          <ul ref={listRef} aria-label="Candidates" onKeyDown={onKeyDown} className="divide-y divide-slate-200">
            {rows.map((app) => {
              const name = nameOf(app);
              const selected = isDesktop && app.id === selectedId;
              return (
                <li key={app.id}>
                  <button
                    type="button"
                    data-row={app.id}
                    aria-current={selected ? "true" : undefined}
                    onClick={() => open(app)}
                    className={cn(
                      "flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors focus-ring",
                      selected ? "bg-navy-soft ring-1 ring-inset ring-navy" : "hover:bg-slate-50"
                    )}
                  >
                    <Avatar name={name} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-slate-950">{name}</span>
                        <ScoreBadge score={scoreOf(app)} size="sm" />
                      </span>
                      <span className="block truncate text-xs text-slate-700" title={app.jobPosting?.title || undefined}>
                        {app.jobPosting?.title || "Job opening"}
                      </span>
                      {app.jobPosting?.mrf?.client?.name && (
                        <span className="block truncate text-xs text-slate-600" title={app.jobPosting.mrf.client.name}>
                          {app.jobPosting.mrf.client.name}
                        </span>
                      )}
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={app.status} size="sm" />
                        <HealthChip status={app.status} days={app.daysInStage} />
                        <span className="text-xs text-slate-600">{daysLabel(app.daysInStage)}</span>
                      </span>
                      {isRepeat(app) && (
                        <span className="mt-1 block truncate text-xs text-slate-700">
                          Applied again · {formatDate(app.createdAt)}
                        </span>
                      )}
                      {nextStepOf(app) !== "None" && (
                        <span className="mt-1 block truncate text-xs text-slate-700">{nextStepOf(app)}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        {isDesktop && (
          <section aria-label="Selected candidate" className={cn("min-w-0 lg:overflow-y-auto", columnHeight)}>
            {selectedId != null && (
              <ReviewPanel
                key={selectedId}
                row={rows.find((row) => row.id === selectedId) ?? rows[0]}
                listSearch={listSearch}
                onDone={onDone}
              />
            )}
          </section>
        )}
      </div>
      {/* Full width under both columns: the list column is too narrow for the page-size control. */}
      {footer && <div className="border-t border-slate-300">{footer}</div>}
    </div>
  );
};
