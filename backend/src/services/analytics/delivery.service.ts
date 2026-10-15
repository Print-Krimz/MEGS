import prisma from "../../utils/prisma.js";
import { manilaDateString } from "../../schemas/field-limits.js";
import { parseDateRange, type AnalyticsFilterDto, type UserScope } from "./analytics.service.js";
import { ownedWhere } from "../ta/ownership.js";
import {
  ACTIVE_PIPELINE_STATUSES,
  FILLED_SEAT_STATUSES,
  POST_SELECTION_STAGES,
  STAGE_ROWS,
  daysBetween,
  exitStageRow,
  latestAttemptOnly,
  manilaDayDiff,
  median,
  percent,
  requestHealth,
  round1,
  stageEntry,
  stageRowFor,
  stagesReached,
  trendBucketStart,
  trendBucketStarts,
  trendGranularity,
  urgencyFor,
  type RequestHealth,
  type StageRowKey,
  type TrendGranularity,
} from "./metric-definitions.js";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface StageTableRow {
  stage: StageRowKey;
  label: string;
  inStageNow: number;
  /** Past the stage limit, measured from a recorded stage change (or a late requirement). */
  overdue: number;
  /** Past the limit only by application age: no stage change was recorded, so the real wait may be shorter. */
  overdueEstimated: number;
  entered: number;
  backedOut: number;
  avgDaysInStage: number | null;
  medianDaysInStage: number | null;
  slaDays: number;
}

export interface DropOffRow {
  stage: StageRowKey;
  label: string;
  reached: number;
  inStage: number;
  movedForward: number;
  backedOut: number;
  rejected: number;
}

export type BackoutPartyKey = "APPLICANT" | "CLIENT" | "AGENCY";

export interface BackoutSummary {
  /** Left before the client saw the candidate. */
  withdrawals: number;
  /** Left once the candidate reached client review or later. */
  backouts: number;
  byParty: Record<BackoutPartyKey, number>;
  byStage: { stage: StageRowKey; label: string; APPLICANT: number; CLIENT: number; AGENCY: number; total: number }[];
  topReasons: { reason: string; count: number }[];
  /** Backouts recorded as NO_SHOW. Counted inside `backouts` or `withdrawals` by stage, shown on their own too. */
  noShows: number;
  byClient: { clientName: string; count: number }[];
  byRequest: { mrfId: number; title: string; clientName: string | null; count: number }[];
  recent: {
    applicationId: number;
    candidateName: string;
    jobTitle: string;
    clientName: string | null;
    mrfId: number | null;
    stage: string;
    party: BackoutPartyKey;
    reason: string;
    occurredAt: string;
  }[];
}

export type ClosureOutcomeKey = "REJECTED" | "BACKED_OUT";
export type ClosureDispositionKey = "TALENT_POOL" | "ARCHIVE";

export interface ClosureCounts {
  total: number;
  talentPool: number;
  archive: number;
  /** Closed before a disposition was recorded (older records). */
  notRecorded: number;
}

/** Applications closed in the period as Rejected or Backed Out, split by what happened to the candidate next. */
export interface ClosureSummary {
  rejected: ClosureCounts;
  backedOut: ClosureCounts;
  topRejectionReasons: { reason: string; count: number }[];
  rejectedByStage: { stage: StageRowKey; label: string; count: number }[];
}

export interface ClientDecisions {
  accepted: number;
  declined: number;
}

export interface StuckCandidate {
  applicationId: number;
  candidateName: string;
  jobTitle: string;
  clientName: string | null;
  mrfId: number | null;
  recruiterId: string;
  recruiterName: string;
  stage: StageRowKey;
  stageLabel: string;
  daysInStage: number;
  slaDays: number;
  daysOver: number;
  urgency: "critical" | "overdue";
  /** No stage change was recorded, so days are counted from the application date. */
  estimated: boolean;
}

export interface TeamRow {
  recruiterId: string;
  name: string;
  active: number;
  overdue: number;
  overdueEstimated: number;
  openRequisitions: number;
  requestedSeats: number;
  filledSeats: number;
  fillRate: number;
  sentToClient: number;
  newStarts: number;
  redeployStarts: number;
  placed: number;
  backouts: number;
  backoutRate: number;
  medianDaysToFill: number | null;
}

/** Why an open request has nothing moving: it has no opening, no applicants, or only first-stage applicants. */
export type RequestAttention = "NO_OPENING" | "NO_APPLICANTS" | "FIRST_STAGE_ONLY" | null;

/** Work no recruiter owns: administrator-posted openings and requests with no assigned TA. */
export interface UnassignedWork {
  applicants: number;
  overdue: number;
  overdueEstimated: number;
  requests: number;
  requestedSeats: number;
  oldestWaitDays: number | null;
}

export interface RequestRow {
  mrfId: number;
  title: string;
  clientId: number;
  clientName: string;
  status: string;
  ownerId: string | null;
  ownerName: string;
  headcount: number;
  filled: number;
  openSeats: number;
  pipeline: number;
  overdueCandidates: number;
  /** Job openings posted under this request, and active applications on them. */
  jobCount: number;
  applicantCount: number;
  attention: RequestAttention;
  targetFillDate: string | null;
  daysRemaining: number | null;
  health: RequestHealth;
  backoutsInPeriod: number;
}

export interface TrendPoint {
  start: string;
  label: string;
  newStarts: number;
  redeployStarts: number;
  /** Left after the client saw the candidate. */
  backouts: number;
  /** Left before the client saw the candidate. */
  withdrawals: number;
}

export interface Trend {
  granularity: TrendGranularity;
  points: TrendPoint[];
}

export interface DateRangeInfo {
  startDate: string;
  endDate: string;
  days: number;
}

export interface DeliveryKpis {
  /** Snapshot: seats filled across the requisitions in scope, now. */
  fillRate: number;
  filledSeats: number;
  requestedSeats: number;
  openSeats: number;
  requisitions: { total: number; open: number; overdue: number; atRisk: number; filled: number };
  /** In period: deployments whose actual start date falls in the selected range. */
  placementsStarted: number;
  newStarts: number;
  redeployStarts: number;
  /** In period: Manila calendar days from requisition created to actual start, for starts that follow a requisition. */
  medianDaysToFill: number | null;
  daysToFillSample: number;
  /** In period: left at or after client review. Rate = backouts / (backouts + starts that came from an application). */
  backoutsAfterClientReview: number;
  backoutRate: number;
  backoutRateBase: number;
  /** Snapshot: candidates in the pipeline now. */
  activeApplicants: number;
  overdueCandidates: number;
  overdueEstimated: number;
  /** Candidates still in the pipeline on a closed job or a filled or cancelled requisition. Not counted as overdue. */
  closedOpenings: number;
  /** Verified overdue candidates who have waited at least twice the stage limit. */
  criticalCandidates: number;
  /** Candidates in the pipeline on an opening that is not linked to any request, so no request counts them. */
  unlinkedApplicants: number;
  /** Requisitions marked FILLED that have no deployment behind them. Excluded from seat counts. */
  staleFilledRequisitions: number;
}

export interface TADeliveryResult {
  dateRange: DateRangeInfo;
  kpis: DeliveryKpis;
  requests: RequestRow[];
  stageTable: StageTableRow[];
  dropOff: DropOffRow[];
  backouts: BackoutSummary;
  closures: ClosureSummary;
  clientDecisions: ClientDecisions;
  /** The TA's own overdue candidates, longest wait first. */
  stuck: StuckCandidate[];
  stuckTotal: number;
}

export type CandidateStatus = "OVERDUE" | "OVERDUE_BY_AGE" | "ON_TIME" | "CLOSED_OPENING" | "AWAITING_START";

/** One row per candidate in the pipeline now. Rows other than "awaiting start" add up to `kpis.activeApplicants`. */
export interface CandidateRow {
  applicationId: number;
  candidateName: string;
  jobTitle: string;
  clientName: string | null;
  mrfId: number | null;
  mrfTitle: string | null;
  recruiterName: string;
  stage: StageRowKey;
  stageLabel: string;
  daysInStage: number;
  slaDays: number;
  status: CandidateStatus;
}

/** One row per start in the period. The row count equals `kpis.placementsStarted`. */
export interface StartRow {
  deploymentId: number;
  workerName: string;
  clientName: string;
  mrfId: number | null;
  mrfTitle: string | null;
  recruiterName: string;
  site: string | null;
  status: string;
  startedAt: Date;
  contractEnd: Date | null;
  isRedeployment: boolean;
  daysToFill: number | null;
}

/** Row-level data behind a dashboard, for reports. Built from the same loaders, so counts match the dashboard. */
export interface DeliveryDetail {
  candidates: CandidateRow[];
  starts: StartRow[];
  /** Every withdrawal and backout in the period. */
  backouts: (BackoutRecord & { recruiterName: string })[];
  /** Every overdue candidate, not capped like the dashboard list. */
  overdue: StuckCandidate[];
  overdueTotal: number;
}

export interface AdminDeliveryResult {
  dateRange: DateRangeInfo;
  kpis: DeliveryKpis;
  team: TeamRow[];
  unassigned: UnassignedWork;
  requests: RequestRow[];
  trend: Trend;
  backouts: BackoutSummary;
  closures: ClosureSummary;
  clientDecisions: ClientDecisions;
  stageTable: StageTableRow[];
  stuck: StuckCandidate[];
  /** Total overdue items before the list is capped. */
  stuckTotal: number;
}

// ─────────────────────────────────────────────
// Scope helpers
// ─────────────────────────────────────────────
const TA_ROLE = "TALENT_ACQUISITION";
const UNASSIGNED = "unassigned";
const UNASSIGNED_NAME = "No recruiter assigned";
const STUCK_LIMIT = 200;

/** The TA whose numbers are shown: always the signed-in TA for a TA, the recruiter filter for an Admin. */
const ownerFilter = (filters: AnalyticsFilterDto, scope?: UserScope): string | undefined =>
  scope?.role === TA_ROLE ? scope.userId : filters.recruiterId;

/** A job belongs to its requisition's assigned TA. A job with no requisition belongs to the TA who posted it. */
const jobOwnerId = (job: { postedById: string; mrf?: { assignedTaId: string | null } | null }): string | null =>
  job.mrf ? job.mrf.assignedTaId : job.postedById;

/** JobPosting filter shared by every query. A TA is always limited to the jobs they own. */
export function buildJobClause(filters: AnalyticsFilterDto, scope?: UserScope): Record<string, unknown> {
  const clause: Record<string, unknown> = {};
  const owner = ownerFilter(filters, scope);
  if (owner) Object.assign(clause, ownedWhere.job({ id: owner, role: TA_ROLE }));
  if (filters.jobPostingId) clause.id = filters.jobPostingId;
  if (filters.mrfId) clause.mrfId = filters.mrfId;
  if (filters.clientId) clause.mrf = { clientId: filters.clientId };
  return clause;
}

const personName = (u?: { email?: string | null; applicantProfile?: { firstName?: string | null; lastName?: string | null } | null } | null) => {
  const full = `${u?.applicantProfile?.firstName ?? ""} ${u?.applicantProfile?.lastName ?? ""}`.trim();
  return full || u?.email || "Unknown";
};

const rangeInfo = (start: Date, end: Date, days: number): DateRangeInfo => ({
  startDate: manilaDateString(start),
  endDate: manilaDateString(end),
  days,
});

const stageLabel = (key: StageRowKey) => STAGE_ROWS.find((r) => r.key === key)!.label;
const NAME_SELECT = { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } as const;
const JOB_OWNER_SELECT = { postedById: true, mrf: { select: { assignedTaId: true } } } as const;

// ─────────────────────────────────────────────
// Snapshot: applications currently in the pipeline
// ─────────────────────────────────────────────
interface SnapshotItem {
  applicationId: number;
  candidateName: string;
  jobTitle: string;
  mrfId: number | null;
  mrfTitle: string | null;
  clientName: string | null;
  ownerId: string | null;
  stage: StageRowKey;
  daysInStage: number;
  slaDays: number;
  /** Past the limit by a recorded stage change, or a required document is late. */
  overdue: boolean;
  /** Past the limit only by application age (no recorded stage change). */
  overdueEstimated: boolean;
  /** Job is closed, or its requisition is filled or cancelled. Reported separately, never counted as overdue. */
  closedOpening: boolean;
}

async function loadSnapshot(jobClause: Record<string, unknown>, now: Date): Promise<SnapshotItem[]> {
  const apps = await prisma.application.findMany({
    where: {
      isArchived: false,
      status: { in: [...ACTIVE_PIPELINE_STATUSES, "DEPLOYED"] as any },
      jobPosting: jobClause as any,
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      user: { select: NAME_SELECT },
      jobPosting: {
        select: {
          title: true,
          mrfId: true,
          status: true,
          postedById: true,
          mrf: { select: { assignedTaId: true, status: true, title: true, client: { select: { name: true, reviewThresholdDays: true } } } },
        },
      },
    },
  });

  // Stage-change history, late requirements and awaiting-start placements are fetched as three small aggregate
  // queries instead of nested relations, which loaded every decision row for every candidate one level at a time.
  const ids = apps.map((a) => a.id);
  const [entries, late, waiting] = ids.length
    ? await Promise.all([
        prisma.recruiterDecision.groupBy({
          by: ["applicationId", "toStatus"],
          where: { applicationId: { in: ids }, isReverted: false },
          _max: { createdAt: true },
        }),
        prisma.complianceRequirement.findMany({
          where: {
            applicationId: { in: ids },
            isRequired: true,
            reviewStatus: { not: "APPROVED" },
            OR: [{ deadline: { lt: now } }, { toFollowExpectedAt: { lt: now } }],
          },
          select: { applicationId: true },
          distinct: ["applicationId"],
        }),
        prisma.deployment.findMany({
          where: { applicationId: { in: ids }, status: "READY_FOR_DEPLOYMENT" },
          select: { applicationId: true },
          distinct: ["applicationId"],
        }),
      ])
    : [[], [], []];
  const decisionsByApp = new Map<number, { fromStatus: string; toStatus: string; createdAt: Date }[]>();
  for (const e of entries) {
    if (!e._max.createdAt) continue;
    const list = decisionsByApp.get(e.applicationId) ?? [];
    list.push({ fromStatus: "", toStatus: e.toStatus, createdAt: e._max.createdAt });
    decisionsByApp.set(e.applicationId, list);
  }
  const lateRequirements = new Set(late.map((r) => r.applicationId));
  const awaitingStart = new Set(waiting.map((d) => d.applicationId));

  const items: SnapshotItem[] = [];
  for (const app of apps) {
    const stage = stageRowFor(app.status);
    if (!stage) continue;
    // DEPLOYED only counts while the placement is waiting to start.
    if (stage === "DEPLOYED" && !awaitingStart.has(app.id)) continue;

    const entry = stageEntry(decisionsByApp.get(app.id) ?? [], app.status, app.createdAt);
    const daysInStage = daysBetween(entry.at, now);
    const row = STAGE_ROWS.find((r) => r.key === stage)!;
    const clientSla = app.jobPosting.mrf?.client?.reviewThresholdDays;
    const slaDays = stage === "CLIENT_ENDORSEMENT" ? clientSla ?? row.slaDays : row.slaDays;
    const lateRequirement = stage === "COMPLIANCE" && lateRequirements.has(app.id);
    const closedOpening =
      app.jobPosting.status === "CLOSED" || ["FILLED", "CANCELLED"].includes(app.jobPosting.mrf?.status ?? "");
    // "Awaiting start" is a scheduled date, not a processing delay, so it is never overdue.
    const pastLimit = stage !== "DEPLOYED" && daysInStage > slaDays;

    items.push({
      applicationId: app.id,
      candidateName: personName(app.user),
      jobTitle: app.jobPosting.title,
      mrfId: app.jobPosting.mrfId,
      mrfTitle: app.jobPosting.mrf?.title ?? null,
      clientName: app.jobPosting.mrf?.client?.name ?? null,
      ownerId: jobOwnerId(app.jobPosting),
      stage,
      daysInStage,
      slaDays,
      overdue: !closedOpening && (lateRequirement || (pastLimit && !entry.estimated)),
      overdueEstimated: !closedOpening && !lateRequirement && pastLimit && entry.estimated,
      closedOpening,
    });
  }
  return items;
}

// ─────────────────────────────────────────────
// Backouts in the period
// ─────────────────────────────────────────────
export interface BackoutRecord {
  applicationId: number;
  stage: string;
  party: BackoutPartyKey;
  reason: string;
  occurredAt: Date;
  candidateName: string;
  jobTitle: string;
  clientName: string | null;
  mrfId: number | null;
  mrfTitle: string | null;
  ownerId: string | null;
  notes: string | null;
  recordedBy: string;
}

async function loadBackouts(jobClause: Record<string, unknown>, from: Date, to?: Date): Promise<BackoutRecord[]> {
  const rows = await prisma.applicationBackout.findMany({
    where: { occurredAt: { gte: from, ...(to ? { lte: to } : {}) }, application: { jobPosting: jobClause as any } },
    orderBy: { occurredAt: "desc" },
    select: {
      applicationId: true,
      stage: true,
      party: true,
      reason: true,
      occurredAt: true,
      notes: true,
      recordedBy: { select: NAME_SELECT },
      application: {
        select: {
          user: { select: NAME_SELECT },
          jobPosting: {
            select: {
              title: true,
              mrfId: true,
              postedById: true,
              mrf: { select: { assignedTaId: true, title: true, client: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });
  return rows.map((r) => ({
    applicationId: r.applicationId,
    stage: r.stage,
    party: r.party as BackoutPartyKey,
    reason: r.reason,
    occurredAt: r.occurredAt,
    candidateName: personName(r.application.user),
    jobTitle: r.application.jobPosting.title,
    clientName: r.application.jobPosting.mrf?.client?.name ?? null,
    mrfId: r.application.jobPosting.mrfId,
    mrfTitle: r.application.jobPosting.mrf?.title ?? null,
    ownerId: jobOwnerId(r.application.jobPosting),
    notes: r.notes,
    recordedBy: personName(r.recordedBy),
  }));
}

export function summarizeBackouts(records: BackoutRecord[], recentLimit = 10): BackoutSummary {
  const byParty: Record<BackoutPartyKey, number> = { APPLICANT: 0, CLIENT: 0, AGENCY: 0 };
  const byStageMap = new Map<StageRowKey, { APPLICANT: number; CLIENT: number; AGENCY: number }>();
  const reasons = new Map<string, number>();
  const clients = new Map<string, number>();
  const requests = new Map<number, { title: string; clientName: string | null; count: number }>();
  let withdrawals = 0;
  let backouts = 0;
  let noShows = 0;

  for (const r of records) {
    byParty[r.party]++;
    if (r.reason === "NO_SHOW") noShows++;
    const client = r.clientName ?? "No client";
    clients.set(client, (clients.get(client) ?? 0) + 1);
    if (r.mrfId !== null) {
      const entry = requests.get(r.mrfId) ?? { title: r.mrfTitle ?? `Request #${r.mrfId}`, clientName: r.clientName, count: 0 };
      entry.count++;
      requests.set(r.mrfId, entry);
    }
    reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1);
    if (POST_SELECTION_STAGES.includes(r.stage)) backouts++;
    else withdrawals++;
    const row = stageRowFor(r.stage) ?? "APPLIED";
    const entry = byStageMap.get(row) ?? { APPLICANT: 0, CLIENT: 0, AGENCY: 0 };
    entry[r.party]++;
    byStageMap.set(row, entry);
  }

  return {
    withdrawals,
    backouts,
    byParty,
    byStage: STAGE_ROWS.filter((r) => byStageMap.has(r.key)).map((r) => {
      const e = byStageMap.get(r.key)!;
      return { stage: r.key, label: r.label, ...e, total: e.APPLICANT + e.CLIENT + e.AGENCY };
    }),
    topReasons: [...reasons.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count })),
    noShows,
    byClient: [...clients.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([clientName, count]) => ({ clientName, count })),
    byRequest: [...requests.entries()]
      .sort((a, b) => b[1].count - a[1].count || a[0] - b[0])
      .slice(0, 5)
      .map(([mrfId, v]) => ({ mrfId, title: v.title, clientName: v.clientName, count: v.count })),
    recent: records.slice(0, recentLimit).map((r) => ({
      applicationId: r.applicationId,
      candidateName: r.candidateName,
      jobTitle: r.jobTitle,
      clientName: r.clientName,
      mrfId: r.mrfId,
      stage: r.stage,
      party: r.party,
      reason: r.reason,
      occurredAt: r.occurredAt.toISOString(),
    })),
  };
}

export interface ClosureRecord {
  outcome: ClosureOutcomeKey;
  disposition: ClosureDispositionKey | null;
  stage: string;
  reasonCode: string;
}

async function loadClosures(jobClause: Record<string, unknown>, from: Date, to: Date): Promise<ClosureRecord[]> {
  const rows = await prisma.applicationClosure.findMany({
    where: { occurredAt: { gte: from, lte: to }, application: { jobPosting: jobClause as any } },
    select: { outcome: true, disposition: true, stage: true, reasonCode: true },
  });
  return rows.map((r) => ({ outcome: r.outcome, disposition: r.disposition, stage: r.stage, reasonCode: r.reasonCode }));
}

export function summarizeClosures(records: ClosureRecord[]): ClosureSummary {
  const empty = (): ClosureCounts => ({ total: 0, talentPool: 0, archive: 0, notRecorded: 0 });
  const rejected = empty();
  const backedOut = empty();
  const reasons = new Map<string, number>();
  const stages = new Map<StageRowKey, number>();

  for (const r of records) {
    const counts = r.outcome === "REJECTED" ? rejected : backedOut;
    counts.total++;
    if (r.disposition === "TALENT_POOL") counts.talentPool++;
    else if (r.disposition === "ARCHIVE") counts.archive++;
    else counts.notRecorded++;
    if (r.outcome === "REJECTED") {
      reasons.set(r.reasonCode, (reasons.get(r.reasonCode) ?? 0) + 1);
      const row = stageRowFor(r.stage) ?? "APPLIED";
      stages.set(row, (stages.get(row) ?? 0) + 1);
    }
  }

  return {
    rejected,
    backedOut,
    topRejectionReasons: [...reasons.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count })),
    rejectedByStage: STAGE_ROWS.filter((r) => stages.has(r.key)).map((r) => ({
      stage: r.key,
      label: r.label,
      count: stages.get(r.key)!,
    })),
  };
}

/** Client answers recorded in the period. APPROVED and ENDORSED both mean the client accepted the candidate. */
async function loadClientDecisions(jobClause: Record<string, unknown>, from: Date, to: Date): Promise<ClientDecisions> {
  const rows = await prisma.clientEndorsement.groupBy({
    by: ["outcome"],
    where: { outcome: { not: "PENDING" }, updatedAt: { gte: from, lte: to }, application: { jobPosting: jobClause as any } },
    _count: { _all: true },
  });
  const count = (...outcomes: string[]) => rows.filter((r) => outcomes.includes(r.outcome)).reduce((s, r) => s + r._count._all, 0);
  return { accepted: count("ENDORSED", "APPROVED"), declined: count("DECLINED") };
}

// ─────────────────────────────────────────────
// Stage table (TA and Admin)
// ─────────────────────────────────────────────
export function buildStageTable(
  snapshot: SnapshotItem[],
  entered: Map<StageRowKey, number>,
  backoutRecords: BackoutRecord[]
): StageTableRow[] {
  return STAGE_ROWS.map((row) => {
    const inStage = snapshot.filter((s) => s.stage === row.key);
    const ages = inStage.map((s) => s.daysInStage);
    const middle = median(ages);
    return {
      stage: row.key,
      label: row.label,
      inStageNow: inStage.length,
      overdue: inStage.filter((s) => s.overdue).length,
      overdueEstimated: inStage.filter((s) => s.overdueEstimated).length,
      entered: entered.get(row.key) ?? 0,
      backedOut: backoutRecords.filter((b) => (stageRowFor(b.stage) ?? "APPLIED") === row.key).length,
      avgDaysInStage: ages.length ? round1(ages.reduce((a, b) => a + b, 0) / ages.length) : null,
      medianDaysInStage: middle === null ? null : round1(middle),
      slaDays: row.slaDays,
    };
  });
}

async function loadEntered(jobClause: Record<string, unknown>, start: Date, end: Date): Promise<Map<StageRowKey, number>> {
  const [decisions, applied] = await Promise.all([
    prisma.recruiterDecision.findMany({
      where: {
        isReverted: false,
        createdAt: { gte: start, lte: end },
        toStatus: { in: STAGE_ROWS.map((r) => r.key).filter((k) => k !== "APPLIED") },
        application: { jobPosting: jobClause as any },
      },
      select: { applicationId: true, toStatus: true },
    }),
    prisma.application.findMany({
      where: { createdAt: { gte: start, lte: end }, jobPosting: jobClause as any },
      select: { userId: true, jobPostingId: true, attemptNumber: true, createdAt: true },
    }),
  ]);

  const perStage = new Map<StageRowKey, Set<number>>();
  for (const d of decisions) {
    const row = stageRowFor(d.toStatus);
    if (!row) continue;
    const set = perStage.get(row) ?? new Set<number>();
    set.add(d.applicationId); // one application entering a stage twice counts once
    perStage.set(row, set);
  }
  const result = new Map<StageRowKey, number>();
  for (const [row, set] of perStage) result.set(row, set.size);
  result.set("APPLIED", latestAttemptOnly(applied).length);
  return result;
}

// ─────────────────────────────────────────────
// Drop-off by stage (TA): applications received in the period
// ─────────────────────────────────────────────
export function buildDropOff(
  apps: {
    status: string;
    decisions: { fromStatus: string; toStatus: string; createdAt: Date; isReverted?: boolean }[];
    backoutStage?: string | null;
  }[]
): DropOffRow[] {
  const rows: DropOffRow[] = STAGE_ROWS.map((r) => ({
    stage: r.key,
    label: r.key === "DEPLOYED" ? "Deployed" : r.label,
    reached: 0,
    inStage: 0,
    movedForward: 0,
    backedOut: 0,
    rejected: 0,
  }));
  const byKey = new Map(rows.map((r) => [r.stage, r]));

  for (const app of apps) {
    const reached = stagesReached(app.status, app.decisions);
    const currentRow = app.status === "BACKOUT" || app.status === "REJECTED" || app.status === "ARCHIVED" || app.status === "TALENT_POOL" ? null : stageRowFor(app.status);
    const exit = exitStageRow(app.status, app.decisions);
    const backoutRow = app.backoutStage ? stageRowFor(app.backoutStage) ?? "APPLIED" : null;

    for (const key of reached) byKey.get(key)!.reached++;
    if (currentRow) byKey.get(currentRow)!.inStage++;
    // A backout record wins over the status: backfilled history keeps its old ARCHIVED status.
    if (app.status === "BACKOUT" || app.backoutStage) byKey.get(backoutRow ?? exit ?? "APPLIED")!.backedOut++;
    else if (exit) byKey.get(exit)!.rejected++;
  }
  for (const r of rows) r.movedForward = Math.max(0, r.reached - r.inStage - r.backedOut - r.rejected);
  return rows;
}

async function loadDropOff(jobClause: Record<string, unknown>, start: Date, end: Date): Promise<DropOffRow[]> {
  const apps = await prisma.application.findMany({
    where: { createdAt: { gte: start, lte: end }, jobPosting: jobClause as any },
    select: {
      userId: true,
      jobPostingId: true,
      attemptNumber: true,
      createdAt: true,
      status: true,
      recruiterDecisions: { select: { fromStatus: true, toStatus: true, createdAt: true, isReverted: true } },
      backout: { select: { stage: true } },
    },
  });
  return buildDropOff(
    latestAttemptOnly(apps).map((a) => ({
      status: a.status,
      decisions: a.recruiterDecisions,
      backoutStage: a.backout?.stage ?? null,
    }))
  );
}

// ─────────────────────────────────────────────
// Placements (deployments that started in the period)
// ─────────────────────────────────────────────
export interface PlacementRecord {
  id: number;
  workerName: string;
  clientName: string;
  mrfId: number | null;
  mrfTitle: string | null;
  site: string | null;
  status: string;
  contractEnd: Date | null;
  ownerId: string | null;
  /** Manila calendar days from requisition created to actual start. Null when there is no requisition or the dates are inconsistent. */
  daysToFill: number | null;
  isRedeployment: boolean;
  /** Came through an application, so a backout is possible. Direct redeployments have none. */
  hasApplication: boolean;
  startedAt: Date;
}

async function loadPlacements(filters: AnalyticsFilterDto, ownerId: string | undefined, from: Date, to?: Date): Promise<PlacementRecord[]> {
  const where: any = {
    actualStart: { gte: from, ...(to ? { lte: to } : {}) },
    status: { not: "CANCELLED" },
  };
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.mrfId) where.mrfId = filters.mrfId;
  if (filters.jobPostingId) where.application = { jobPostingId: filters.jobPostingId };
  if (ownerId) where.AND = [ownedWhere.deployment({ id: ownerId, role: TA_ROLE })];

  const deployments = await prisma.deployment.findMany({
    where,
    select: {
      id: true,
      employeeId: true,
      createdAt: true,
      actualStart: true,
      contractEnd: true,
      site: true,
      status: true,
      createdById: true,
      applicationId: true,
      client: { select: { name: true } },
      employee: { select: { user: { select: NAME_SELECT } } },
      mrf: { select: { id: true, title: true, createdAt: true, assignedTaId: true } },
      application: { select: { jobPosting: { select: JOB_OWNER_SELECT } } },
    },
  });
  if (deployments.length === 0) return [];

  // A placement is a redeployment when the same employee already had an earlier, non-cancelled deployment.
  const earlier = await prisma.deployment.findMany({
    where: { employeeId: { in: [...new Set(deployments.map((d) => d.employeeId))] }, status: { not: "CANCELLED" } },
    select: { employeeId: true, createdAt: true },
  });
  const firstDeployment = new Map<number, Date>();
  for (const e of earlier) {
    const seen = firstDeployment.get(e.employeeId);
    if (!seen || e.createdAt < seen) firstDeployment.set(e.employeeId, e.createdAt);
  }

  return deployments.map((d) => {
    const days = d.mrf && d.actualStart ? manilaDayDiff(d.mrf.createdAt, d.actualStart) : null;
    const first = firstDeployment.get(d.employeeId);
    return {
      id: d.id,
      workerName: personName(d.employee?.user),
      clientName: d.client?.name ?? "Client",
      mrfId: d.mrf?.id ?? null,
      mrfTitle: d.mrf?.title ?? null,
      site: d.site,
      status: d.status,
      contractEnd: d.contractEnd,
      // Same chain as ownership: requisition, then the application's job, then whoever created the deployment.
      ownerId: d.mrf ? d.mrf.assignedTaId : d.application ? jobOwnerId(d.application.jobPosting) : d.createdById,
      daysToFill: days !== null && days >= 0 ? days : null,
      isRedeployment: first !== undefined && first < d.createdAt,
      hasApplication: d.applicationId !== null,
      startedAt: d.actualStart!,
    };
  });
}

// ─────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────
export function buildKpis(
  requests: Pick<RequestRow, "headcount" | "filled" | "health">[],
  placements: Pick<PlacementRecord, "daysToFill" | "isRedeployment" | "hasApplication">[],
  postSelectionBackouts: number,
  snapshot: Pick<SnapshotItem, "stage" | "overdue" | "overdueEstimated" | "closedOpening" | "mrfId" | "daysInStage" | "slaDays">[] = [],
  staleFilledRequisitions = 0
): DeliveryKpis {
  const requestedSeats = requests.reduce((s, r) => s + r.headcount, 0);
  const filledSeats = requests.reduce((s, r) => s + Math.min(r.filled, r.headcount), 0);
  const fillTimes = placements.map((p) => p.daysToFill).filter((n): n is number => n !== null);
  const medianFill = median(fillTimes);
  const redeployStarts = placements.filter((p) => p.isRedeployment).length;
  const backoutRateBase = postSelectionBackouts + placements.filter((p) => p.hasApplication).length;
  const pipeline = snapshot.filter((s) => s.stage !== "DEPLOYED");
  const count = (health: RequestHealth) => requests.filter((r) => r.health === health).length;
  return {
    fillRate: percent(filledSeats, requestedSeats),
    filledSeats,
    requestedSeats,
    openSeats: Math.max(0, requestedSeats - filledSeats),
    requisitions: {
      total: requests.length,
      open: requests.length - count("FILLED"),
      overdue: count("OVERDUE"),
      atRisk: count("AT_RISK"),
      filled: count("FILLED"),
    },
    placementsStarted: placements.length,
    newStarts: placements.length - redeployStarts,
    redeployStarts,
    medianDaysToFill: medianFill === null ? null : round1(medianFill),
    daysToFillSample: fillTimes.length,
    backoutsAfterClientReview: postSelectionBackouts,
    backoutRate: percent(postSelectionBackouts, backoutRateBase),
    backoutRateBase,
    activeApplicants: pipeline.length,
    overdueCandidates: pipeline.filter((s) => s.overdue).length,
    overdueEstimated: pipeline.filter((s) => s.overdueEstimated).length,
    closedOpenings: pipeline.filter((s) => s.closedOpening).length,
    // Same population as the overdue list (verified and by-age-only), so the headline matches the list it opens.
    criticalCandidates: pipeline.filter((s) => (s.overdue || s.overdueEstimated) && urgencyFor(s.daysInStage, s.slaDays) === "critical").length,
    unlinkedApplicants: pipeline.filter((s) => s.mrfId === null).length,
    staleFilledRequisitions,
  };
}

// ─────────────────────────────────────────────
// Requisitions in scope
// ─────────────────────────────────────────────
/**
 * Requisitions that are open, plus filled ones whose seats were filled in the period.
 * Filled seats come from deployments, never from the requisition status: a requisition marked FILLED with no
 * deployment behind it is counted as stale data, not as filled.
 */
async function fetchRequests(filters: AnalyticsFilterDto, ownerId: string | undefined, start: Date, end: Date) {
  const scope: any[] = [];
  if (filters.clientId) scope.push({ clientId: filters.clientId });
  if (filters.mrfId) scope.push({ id: filters.mrfId });
  if (filters.jobPostingId) scope.push({ jobPostings: { some: { id: filters.jobPostingId } } });
  if (ownerId) scope.push(ownedWhere.mrf({ id: ownerId, role: TA_ROLE }));

  const filledSeat = { status: { in: FILLED_SEAT_STATUSES as any } };
  const [mrfs, staleFilled] = await Promise.all([
    prisma.manpowerRequest.findMany({
      where: {
        AND: [
          ...scope,
          {
            OR: [
              { status: "OPEN" },
              { status: "FILLED", deployments: { some: { ...filledSeat, createdAt: { gte: start, lte: end } } } },
            ],
          },
        ],
      },
      select: {
        id: true,
        title: true,
        headcount: true,
        status: true,
        targetFillDate: true,
        clientId: true,
        client: { select: { name: true } },
        assignedTaId: true,
        assignedTa: { select: NAME_SELECT },
        deployments: { where: filledSeat, select: { id: true } },
        _count: { select: { jobPostings: true } },
      },
    }),
    prisma.manpowerRequest.count({ where: { AND: [...scope, { status: "FILLED", deployments: { none: filledSeat } }] } }),
  ]);
  return { mrfs, staleFilled };
}

/**
 * Requisitions that are open, plus filled ones whose seats were filled in the period.
 * Filled seats come from deployments, never from the requisition status: a requisition marked FILLED with no
 * deployment behind it is counted as stale data, not as filled.
 */
function assembleRequests(
  mrfs: Awaited<ReturnType<typeof fetchRequests>>["mrfs"],
  snapshot: SnapshotItem[],
  backoutRecords: BackoutRecord[],
  now: Date
): RequestRow[] {
  const order: Record<RequestHealth, number> = { OVERDUE: 0, AT_RISK: 1, ON_TRACK: 2, FILLED: 3 };
  return mrfs
    .map((m) => {
      const headcount = Math.max(1, m.headcount || 1);
      const filled = m.deployments.length;
      const items = snapshot.filter((s) => s.mrfId === m.id);
      const pipeline = items.filter((s) => s.stage !== "APPLIED" && s.stage !== "DEPLOYED").length;
      const days = m.targetFillDate ? Math.ceil((m.targetFillDate.getTime() - now.getTime()) / 86_400_000) : null;
      const jobCount = m._count.jobPostings;
      // Active applicants on this request's openings, from the snapshot already loaded (no extra query).
      const applicantCount = items.filter((s) => s.stage !== "DEPLOYED").length;
      const health = requestHealth({ headcount, filled, pipeline, targetFillDate: m.targetFillDate, now });
      const attention: RequestAttention =
        health === "FILLED" ? null : jobCount === 0 ? "NO_OPENING" : applicantCount === 0 ? "NO_APPLICANTS" : pipeline === 0 ? "FIRST_STAGE_ONLY" : null;
      return {
        mrfId: m.id,
        title: m.title,
        clientId: m.clientId,
        clientName: m.client.name,
        status: m.status,
        ownerId: m.assignedTaId,
        ownerName: m.assignedTa ? personName(m.assignedTa) : UNASSIGNED_NAME,
        headcount,
        filled,
        openSeats: Math.max(0, headcount - filled),
        pipeline,
        overdueCandidates: items.filter((s) => s.overdue).length,
        jobCount,
        applicantCount,
        attention,
        targetFillDate: m.targetFillDate ? m.targetFillDate.toISOString() : null,
        daysRemaining: days,
        health,
        backoutsInPeriod: backoutRecords.filter((b) => b.mrfId === m.id).length,
      };
    })
    .sort(
      (a, b) =>
        order[a.health] - order[b.health] ||
        (a.targetFillDate ?? "9999").localeCompare(b.targetFillDate ?? "9999")
    );
}

// ─────────────────────────────────────────────
// Overdue list (shared by TA and Admin)
// ─────────────────────────────────────────────
function buildStuck(snapshot: SnapshotItem[], recruiterOf: (ownerId: string | null) => { id: string; name: string }, limit = STUCK_LIMIT) {
  const all = snapshot
    .filter((s) => s.overdue || s.overdueEstimated)
    .map((s) => ({ s, daysOver: Math.max(1, Math.floor(s.daysInStage - s.slaDays)) }))
    // Verified waits before age-only ones, then longest wait first.
    .sort((a, b) => Number(a.s.overdueEstimated) - Number(b.s.overdueEstimated) || b.daysOver - a.daysOver || a.s.applicationId - b.s.applicationId);
  const items: StuckCandidate[] = all.slice(0, limit).map(({ s, daysOver }) => {
    const who = recruiterOf(s.ownerId);
    return {
      applicationId: s.applicationId,
      candidateName: s.candidateName,
      jobTitle: s.jobTitle,
      clientName: s.clientName,
      mrfId: s.mrfId,
      recruiterId: who.id,
      recruiterName: who.name,
      stage: s.stage,
      stageLabel: stageLabel(s.stage),
      daysInStage: Math.floor(s.daysInStage),
      slaDays: s.slaDays,
      daysOver,
      urgency: urgencyFor(s.daysInStage, s.slaDays),
      estimated: s.overdueEstimated,
    };
  });
  return { items, total: all.length };
}

// ─────────────────────────────────────────────
// Trend
// ─────────────────────────────────────────────
export function buildTrend(
  placements: { startedAt: Date; isRedeployment: boolean }[],
  backouts: { occurredAt: Date; stage: string }[],
  start: Date,
  end: Date,
  days: number
): Trend {
  const granularity = trendGranularity(days);
  const points = new Map<string, TrendPoint>(
    trendBucketStarts(start, end, granularity).map((key) => {
      const [y, m, d] = key.split("-").map(Number);
      const label = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-PH", {
        timeZone: "UTC",
        month: "short",
        ...(granularity === "month" ? { year: "numeric" } : { day: "numeric" }),
      });
      return [key, { start: key, label, newStarts: 0, redeployStarts: 0, backouts: 0, withdrawals: 0 }];
    })
  );
  for (const p of placements) {
    const point = points.get(trendBucketStart(p.startedAt, granularity));
    if (!point) continue;
    if (p.isRedeployment) point.redeployStarts++;
    else point.newStarts++;
  }
  for (const b of backouts) {
    const point = points.get(trendBucketStart(b.occurredAt, granularity));
    if (!point) continue;
    if (POST_SELECTION_STAGES.includes(b.stage)) point.backouts++;
    else point.withdrawals++;
  }
  return { granularity, points: [...points.values()] };
}

function buildDetail(
  snapshot: SnapshotItem[],
  placements: PlacementRecord[],
  backoutRecords: BackoutRecord[],
  recruiterOf: (ownerId: string | null) => { id: string; name: string }
): DeliveryDetail {
  const candidates: CandidateRow[] = snapshot
    .map((s) => ({
      applicationId: s.applicationId,
      candidateName: s.candidateName,
      jobTitle: s.jobTitle,
      clientName: s.clientName,
      mrfId: s.mrfId,
      mrfTitle: s.mrfTitle,
      recruiterName: recruiterOf(s.ownerId).name,
      stage: s.stage,
      stageLabel: stageLabel(s.stage),
      daysInStage: Math.floor(s.daysInStage),
      slaDays: s.slaDays,
      status: (s.stage === "DEPLOYED"
        ? "AWAITING_START"
        : s.closedOpening
          ? "CLOSED_OPENING"
          : s.overdue
            ? "OVERDUE"
            : s.overdueEstimated
              ? "OVERDUE_BY_AGE"
              : "ON_TIME") as CandidateStatus,
    }))
    .sort((a, b) => b.daysInStage - b.slaDays - (a.daysInStage - a.slaDays) || a.applicationId - b.applicationId);
  const starts: StartRow[] = placements
    .map((p) => ({
      deploymentId: p.id,
      workerName: p.workerName,
      clientName: p.clientName,
      mrfId: p.mrfId,
      mrfTitle: p.mrfTitle,
      recruiterName: recruiterOf(p.ownerId).name,
      site: p.site,
      status: p.status,
      startedAt: p.startedAt,
      contractEnd: p.contractEnd,
      isRedeployment: p.isRedeployment,
      daysToFill: p.daysToFill,
    }))
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime() || a.deploymentId - b.deploymentId);
  const overdue = buildStuck(snapshot, recruiterOf, Infinity);
  const backouts = backoutRecords.map((b) => ({ ...b, recruiterName: recruiterOf(b.ownerId).name }));
  return { candidates, starts, backouts, overdue: overdue.items, overdueTotal: overdue.total };
}

// ─────────────────────────────────────────────
// TA dashboard
// ─────────────────────────────────────────────
export const getTADelivery = async (filters: AnalyticsFilterDto, scope: UserScope, now = new Date()): Promise<TADeliveryResult> =>
  (await computeTADelivery(filters, scope, now)).result;

/** Dashboard result plus the row-level data behind it. Reports use this so they cannot drift from the dashboard. */
export const getTAReportData = (filters: AnalyticsFilterDto, scope: UserScope, now = new Date()) => computeTADelivery(filters, scope, now);

async function computeTADelivery(
  filters: AnalyticsFilterDto,
  scope: UserScope,
  now: Date
): Promise<{ result: TADeliveryResult; detail: DeliveryDetail }> {
  const { start, end, days } = parseDateRange(filters);
  const jobClause = buildJobClause(filters, scope);
  const owner = ownerFilter(filters, scope);
  const [snapshot, entered, backoutRecords, closureRecords, dropOff, placements, clientDecisions, fetched] = await Promise.all([
    loadSnapshot(jobClause, now),
    loadEntered(jobClause, start, end),
    loadBackouts(jobClause, start, end),
    loadClosures(jobClause, start, end),
    loadDropOff(jobClause, start, end),
    loadPlacements(filters, owner, start, end),
    loadClientDecisions(jobClause, start, end),
    fetchRequests(filters, owner, start, end),
  ]);
  const requests = assembleRequests(fetched.mrfs, snapshot, backoutRecords, now);
  const postSelection = backoutRecords.filter((b) => POST_SELECTION_STAGES.includes(b.stage));
  // Everything a TA sees is their own, so the recruiter column is just "You".
  const self = () => ({ id: scope.userId, name: "You" });
  const stuck = buildStuck(snapshot, self);
  const result: TADeliveryResult = {
    dateRange: rangeInfo(start, end, days),
    kpis: buildKpis(requests, placements, postSelection.length, snapshot, fetched.staleFilled),
    requests,
    stageTable: buildStageTable(snapshot, entered, backoutRecords),
    dropOff,
    backouts: summarizeBackouts(backoutRecords),
    closures: summarizeClosures(closureRecords),
    clientDecisions,
    stuck: stuck.items,
    stuckTotal: stuck.total,
  };
  return { result, detail: buildDetail(snapshot, placements, backoutRecords, self) };
}

// ─────────────────────────────────────────────
// Admin (team leader) dashboard
// ─────────────────────────────────────────────
export const getAdminDelivery = async (filters: AnalyticsFilterDto, now = new Date()): Promise<AdminDeliveryResult> =>
  (await computeAdminDelivery(filters, now)).result;

/** Dashboard result plus the row-level data behind it. Reports use this so they cannot drift from the dashboard. */
export const getAdminReportData = (filters: AnalyticsFilterDto, now = new Date()) => computeAdminDelivery(filters, now);

async function computeAdminDelivery(
  filters: AnalyticsFilterDto,
  now: Date
): Promise<{ result: AdminDeliveryResult; detail: DeliveryDetail }> {
  const { start, end, days } = parseDateRange(filters);
  const jobClause = buildJobClause(filters);
  const owner = ownerFilter(filters);

  const [snapshot, entered, backoutRecords, closureRecords, placements, endorsements, clientDecisions, fetched] = await Promise.all([
    loadSnapshot(jobClause, now),
    loadEntered(jobClause, start, end),
    loadBackouts(jobClause, start, end),
    loadClosures(jobClause, start, end),
    loadPlacements(filters, owner, start, end),
    prisma.clientEndorsement.findMany({
      where: { createdAt: { gte: start, lte: end }, application: { jobPosting: jobClause as any } },
      select: { applicationId: true, application: { select: { jobPosting: { select: JOB_OWNER_SELECT } } } },
    }),
    loadClientDecisions(jobClause, start, end),
    fetchRequests(filters, owner, start, end),
  ]);

  const requests = assembleRequests(fetched.mrfs, snapshot, backoutRecords, now);
  const staleFilled = fetched.staleFilled;
  const postSelection = backoutRecords.filter((b) => POST_SELECTION_STAGES.includes(b.stage));

  // Only owners that appear in the data are looked up. A requisition with no assigned TA, or work owned by an
  // administrator account, is not a recruiter's: it is reported as "unassigned" so the totals still add up.
  const ownerIds = [
    ...snapshot.map((s) => s.ownerId),
    ...placements.map((p) => p.ownerId),
    ...backoutRecords.map((b) => b.ownerId),
    ...requests.map((r) => r.ownerId),
    ...endorsements.map((e) => jobOwnerId(e.application.jobPosting)),
    ...(filters.recruiterId ? [filters.recruiterId] : []),
  ].filter((id): id is string => id !== null);
  const people = ownerIds.length
    ? await prisma.user.findMany({ where: { id: { in: [...new Set(ownerIds)] } }, select: { id: true, role: true, ...NAME_SELECT } })
    : [];
  const nonTaIds = new Set(people.filter((u) => u.role !== TA_ROLE).map((u) => u.id));
  const keyOf = (id: string | null) => (id === null || nonTaIds.has(id) ? UNASSIGNED : id);

  const names = new Map<string, string>(people.map((u) => [u.id, personName(u)]));
  names.set(UNASSIGNED, UNASSIGNED_NAME);

  const keys = new Set<string>(filters.recruiterId ? [keyOf(filters.recruiterId)] : ownerIds.map(keyOf));
  keys.delete(UNASSIGNED);

  const team: TeamRow[] = [...keys]
    .map((key) => {
      const active = snapshot.filter((s) => keyOf(s.ownerId) === key && s.stage !== "DEPLOYED");
      const mine = placements.filter((p) => keyOf(p.ownerId) === key);
      const reqs = requests.filter((r) => keyOf(r.ownerId) === key);
      const lost = postSelection.filter((b) => keyOf(b.ownerId) === key).length;
      const fill = median(mine.map((p) => p.daysToFill).filter((n): n is number => n !== null));
      const sent = new Set(
        endorsements.filter((e) => keyOf(jobOwnerId(e.application.jobPosting)) === key).map((e) => e.applicationId)
      ).size;
      const requestedSeats = reqs.reduce((t, r) => t + r.headcount, 0);
      const filledSeats = reqs.reduce((t, r) => t + Math.min(r.filled, r.headcount), 0);
      const redeployStarts = mine.filter((p) => p.isRedeployment).length;
      return {
        recruiterId: key,
        name: names.get(key) ?? "Unknown",
        active: active.length,
        overdue: active.filter((s) => s.overdue).length,
        overdueEstimated: active.filter((s) => s.overdueEstimated).length,
        openRequisitions: reqs.filter((r) => r.health !== "FILLED").length,
        requestedSeats,
        filledSeats,
        fillRate: percent(filledSeats, requestedSeats),
        sentToClient: sent,
        newStarts: mine.length - redeployStarts,
        redeployStarts,
        placed: mine.length,
        backouts: lost,
        backoutRate: percent(lost, lost + mine.filter((p) => p.hasApplication).length),
        medianDaysToFill: fill === null ? null : round1(fill),
      };
    })
    // Hide TAs with nothing to show; always keep the one being filtered on.
    .filter((r) => (filters.recruiterId && r.recruiterId === keyOf(filters.recruiterId)) || r.active + r.openRequisitions + r.placed + r.backouts + r.sentToClient > 0)
    .sort((a, b) => b.overdue - a.overdue || b.active - a.active || a.name.localeCompare(b.name));

  const orphaned = snapshot.filter((s) => keyOf(s.ownerId) === UNASSIGNED && s.stage !== "DEPLOYED");
  const orphanRequests = requests.filter((r) => keyOf(r.ownerId) === UNASSIGNED && r.health !== "FILLED");
  const unassigned: UnassignedWork = {
    applicants: orphaned.length,
    overdue: orphaned.filter((s) => s.overdue).length,
    overdueEstimated: orphaned.filter((s) => s.overdueEstimated).length,
    requests: orphanRequests.length,
    requestedSeats: orphanRequests.reduce((t, r) => t + r.openSeats, 0),
    oldestWaitDays: orphaned.length ? Math.floor(Math.max(...orphaned.map((s) => s.daysInStage))) : null,
  };

  const recruiterOf = (ownerId: string | null) => {
    const id = keyOf(ownerId);
    return { id, name: names.get(id) ?? UNASSIGNED_NAME };
  };
  const stuck = buildStuck(snapshot, recruiterOf);

  const result: AdminDeliveryResult = {
    dateRange: rangeInfo(start, end, days),
    kpis: buildKpis(requests, placements, postSelection.length, snapshot, staleFilled),
    team,
    unassigned,
    requests,
    trend: buildTrend(placements, backoutRecords, start, end, days),
    backouts: summarizeBackouts(backoutRecords),
    closures: summarizeClosures(closureRecords),
    clientDecisions,
    stageTable: buildStageTable(snapshot, entered, backoutRecords),
    stuck: stuck.items,
    stuckTotal: stuck.total,
  };
  return { result, detail: buildDetail(snapshot, placements, backoutRecords, recruiterOf) };
}
