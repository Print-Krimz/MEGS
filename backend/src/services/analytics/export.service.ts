import { resolveUserName } from "../../utils/user-name.js";
import prisma from "../../utils/prisma.js";
import { parseDateRange, type AnalyticsFilterDto } from "./analytics.service.js";
import {
  buildJobClause,
  getAdminReportData,
  getTAReportData,
  type AdminDeliveryResult,
  type CandidateStatus,
  type DeliveryDetail,
  type RequestAttention,
  type TADeliveryResult,
} from "./delivery.service.js";
import { METRICS, STAGE_ROWS, backoutReasonLabel, manilaDayDiff, stageRowFor, type MetricDefinition, type MetricKey } from "./metric-definitions.js";
import { manilaDateString } from "../../schemas/field-limits.js";
import { ownedWhere } from "../ta/ownership.js";
import { getReportMetadata, type ReportMetadata, type ReportRoleScope } from "./report-theme.js";
import {
  createHRDocument,
  renderCorporateHeader,
  renderFootersAndPagination,
  renderGridTable,
  renderSectionTitle,
  renderSummaryKPIs,
} from "./report-pdf-builder.js";
import { displayEmail } from "../../utils/display-email.js";
import {
  applyDataRowsAndFormatting,
  applySpreadsheetHeaderBlock,
  applyTableHeaders,
  createHRExcelWorkbook,
  writeWorkbookToBuffer,
  type ExcelColumnDef,
} from "./report-excel-builder.js";

// ─────────────────────────────────────────────
// Reports are built from the dashboard's own computation (getAdminReportData / getTAReportData), so a figure in a
// report is the same number the dashboard shows. Each table is defined once and drawn by both the PDF and the Excel
// writer, so the two formats cannot disagree either.
// ─────────────────────────────────────────────

type Cell = string | number | null;

interface Column {
  header: string;
  key: string;
  /** Relative width. Scaled to the page in the PDF and to a column width in Excel. */
  weight: number;
  align?: "left" | "center" | "right";
  badge?: boolean;
}

interface Section {
  sheet: string;
  title: string;
  note?: string;
  /** False for long raw lists that are Excel-only. The PDF says so instead of printing hundreds of pages. */
  inPdf?: boolean;
  columns: Column[];
  rows: Record<string, Cell>[];
}

interface Kpi {
  label: string;
  value: string | number;
  detail: string;
  basis: MetricDefinition["window"];
  definition: string;
}

interface ReportModel {
  kpis: Kpi[];
  sections: Section[];
  /** The period and filters the numbers cover, in words. */
  filterSummary: string;
}

type ReportResult = (AdminDeliveryResult | TADeliveryResult) & { team?: AdminDeliveryResult["team"]; unassigned?: AdminDeliveryResult["unassigned"] };
type Requester = { id: string; email: string; role?: string };

const PDF_ROW_LIMIT = 1000;
const TA = "TALENT_ACQUISITION";

// ─────────────────────────────────────────────
// Text helpers
// ─────────────────────────────────────────────
/** Drops characters that break Excel's XML or a one-line PDF cell. */
const clean = (value: string): string => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/[\r\n\t]+/g, " ").trim();
const sentenceCase = (code: string): string => {
  const text = code.toLowerCase().replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};
const date = (d: Date | string | null | undefined): string => (d ? manilaDateString(typeof d === "string" ? new Date(d) : d) : "");
const stageLabelOf = (status: string): string => {
  const row = stageRowFor(status);
  return row ? STAGE_ROWS.find((r) => r.key === row)!.label : sentenceCase(status);
};

const HEALTH_LABEL = { OVERDUE: "Overdue", AT_RISK: "At risk", ON_TRACK: "On track", FILLED: "Filled" } as const;
const ATTENTION_LABEL: Record<Exclude<RequestAttention, null>, string> = {
  NO_OPENING: "No job post yet",
  NO_APPLICANTS: "No applicants yet",
  FIRST_STAGE_ONLY: "No one past first screening",
};
const CANDIDATE_STATUS_LABEL: Record<CandidateStatus, string> = {
  OVERDUE: "Overdue",
  OVERDUE_BY_AGE: "Estimated overdue",
  ON_TIME: "On time",
  CLOSED_OPENING: "Job opening closed",
  AWAITING_START: "Waiting to start",
};
const PARTY_LABEL: Record<string, string> = { APPLICANT: "Applicant", CLIENT: "Client", AGENCY: "Agency" };
const POST_SELECTION = ["CLIENT_ENDORSEMENT", "FINAL_INTERVIEW", "COMPLIANCE", "CONTRACT_SIGNING", "DEPLOYED"];

// ─────────────────────────────────────────────
// Scope and filters
// ─────────────────────────────────────────────
/** Authorization follows the signed-in user, never the layout the caller asks for. */
const isAdminUser = (requestedBy: Requester) => requestedBy.role === "ADMINISTRATOR";
const roleScopeOf = (requestedBy: Requester): ReportRoleScope => (isAdminUser(requestedBy) ? "ADMINISTRATOR" : "TALENT_ACQUISITION");

async function describeFilters(filters: AnalyticsFilterDto, requestedBy: Requester, start: Date, end: Date): Promise<string> {
  const admin = isAdminUser(requestedBy);
  // A TA can only have names resolved for their own records, so a guessed id never reveals someone else's client.
  const actor = { id: requestedBy.id, role: admin ? "ADMINISTRATOR" : TA };
  const [client, request, job, recruiter] = await Promise.all([
    filters.clientId ? prisma.client.findFirst({ where: { id: filters.clientId, ...ownedWhere.client(actor) } as any, select: { name: true } }) : null,
    filters.mrfId ? prisma.manpowerRequest.findFirst({ where: { id: filters.mrfId, ...ownedWhere.mrf(actor) } as any, select: { title: true } }) : null,
    filters.jobPostingId ? prisma.jobPosting.findFirst({ where: { id: filters.jobPostingId, ...ownedWhere.job(actor) } as any, select: { title: true } }) : null,
    admin && filters.recruiterId
      ? prisma.user.findFirst({
          where: { id: filters.recruiterId, role: TA },
          select: { role: true, displayName: true, email: true, applicantProfile: { select: { firstName: true, lastName: true } } },
        })
      : null,
  ]);
  const parts = [`Dates: ${manilaDateString(start)} to ${manilaDateString(end)}`];
  if (filters.clientId) parts.push(`Client: ${client?.name ?? "not available"}`);
  if (filters.mrfId) parts.push(`Client request: ${request?.title ?? "not available"}`);
  if (filters.jobPostingId) parts.push(`Job opening: ${job?.title ?? "not available"}`);
  if (admin) {
    const name = recruiter ? resolveUserName(recruiter) : null;
    parts.push(filters.recruiterId ? `Recruiter: ${name ?? "not available"}` : "All recruiters");
  } else {
    parts.push("Only your own requests and candidates");
  }
  return parts.join(" | ");
}

// ─────────────────────────────────────────────
// KPI and table definitions (shared by PDF and Excel)
// ─────────────────────────────────────────────
/** A KPI whose label, window and definition come from the shared METRICS, so the screen and the report cannot drift. */
const metricKpi = (key: MetricKey, value: string | number, detail: string): Kpi => {
  const m = METRICS[key];
  return { label: m.label, value, detail, basis: m.window, definition: m.definition };
};

/** Same five-case rule as the screen: a rate or typical time with fewer than MIN_SAMPLE cases is not printed as a number. */
// Same words as the screen (frontend/src/lib/analytics-format.ts sampleNote).
const notEnoughData = (_n: number): string => "No data yet";
const valueOrNote = (value: number | null, n: number, format: (v: number) => string | number = (v) => v): string | number =>
  value === null ? notEnoughData(n) : format(value);
const pct = (v: number): string => `${v}%`;

function kpisFor(result: ReportResult): Kpi[] {
  const k = result.kpis;
  return [
    metricKpi(
      "activeApplicants",
      k.activeApplicants,
      k.unlinkedApplicants > 0 ? `${k.unlinkedApplicants} applied to a job post with no client request` : "Still being processed today"
    ),
    metricKpi("openRequests", k.requisitions.open, `${k.filledSeats} of ${k.requestedSeats} seats filled. ${k.lateRequests} overdue or at risk`),
    metricKpi("overdueCandidates", k.overdueTotal, `${k.overdueCandidates} recorded, ${k.overdueEstimated} estimated from application date`),
    metricKpi("starts", k.placementsStarted, `${k.newStarts} new, ${k.redeployStarts} redeployed`),
    metricKpi("backoutsAfterClientReview", k.backoutsAfterClientReview, `${k.backoutsAfterClientReview} of ${k.backoutRateBase} (backouts plus starts)`),
    metricKpi("backoutRate", valueOrNote(k.backoutRate, k.backoutRateBase, pct), `${k.backoutsAfterClientReview} of ${k.backoutRateBase}`),
    metricKpi("withdrawals", result.backouts.withdrawals, "Left before the client reviewed them"),
  ];
}

function requestsSection(result: ReportResult, admin: boolean): Section {
  const columns: Column[] = [
    { header: "Client request", key: "title", weight: 120 },
    { header: "Client", key: "client", weight: 95 },
    ...(admin ? [{ header: "Recruiter", key: "owner", weight: 90 }] : []),
    { header: "Seats needed", key: "headcount", weight: 46, align: "right" as const },
    { header: "Seats filled", key: "filled", weight: 46, align: "right" as const },
    { header: "Seats open", key: "open", weight: 44, align: "right" as const },
    { header: "In process", key: "pipeline", weight: 48, align: "right" as const },
    { header: "Overdue", key: "overdue", weight: 38, align: "right" as const },
    { header: "Total candidates", key: "applicants", weight: 56, align: "right" as const },
    { header: "Status", key: "status", weight: 62, align: "center" as const, badge: true },
    { header: "Due date", key: "due", weight: 58, align: "center" as const },
    { header: "What to check", key: "attention", weight: 95 },
  ];
  return {
    sheet: "Client requests",
    title: "Client requests",
    note: "Requests still open, plus any filled in these dates. In process means candidates still moving through the stages. Overdue = applicants who waited longer than the days allowed. Due date = when the client wants the seats filled.",
    columns,
    rows: result.requests.map((r) => ({
      title: clean(r.title),
      client: clean(r.clientName),
      owner: r.ownerId === null ? "No recruiter assigned" : clean(r.ownerName),
      headcount: r.headcount,
      filled: r.filled,
      open: r.openSeats,
      pipeline: r.pipeline,
      overdue: r.overdueCandidates,
      applicants: r.applicantCount,
      status: HEALTH_LABEL[r.health],
      due: date(r.targetFillDate),
      attention: r.attention ? ATTENTION_LABEL[r.attention] : "",
    })),
  };
}

function overdueSection(detail: DeliveryDetail, admin: boolean): Section {
  return {
    sheet: "Overdue candidates",
    title: "Overdue candidates",
    note: "Candidates past the days allowed for their stage. Candidates with a recorded wait come first. Estimated means no stage change was recorded, so days count from the application date and may be higher than the real wait.",
    columns: [
      { header: "Candidate", key: "candidate", weight: 120 },
      { header: "Job opening", key: "job", weight: 115 },
      { header: "Client", key: "client", weight: 95 },
      ...(admin ? [{ header: "Recruiter", key: "recruiter", weight: 90 }] : []),
      { header: "Current stage", key: "stage", weight: 90 },
      { header: "Days in this stage", key: "days", weight: 60, align: "right" as const },
      { header: "Days allowed", key: "limit", weight: 52, align: "right" as const },
      { header: "Days over", key: "over", weight: 48, align: "right" as const },
      { header: "Wait recorded or estimated", key: "basis", weight: 90 },
      { header: "Urgency", key: "urgency", weight: 60, align: "center" as const, badge: true },
    ],
    rows: detail.overdue.map((o) => ({
      candidate: clean(o.candidateName),
      job: clean(o.jobTitle),
      client: clean(o.clientName ?? ""),
      recruiter: clean(o.recruiterName),
      stage: o.stageLabel,
      days: o.daysInStage,
      limit: o.slaDays,
      over: o.daysOver,
      basis: o.estimated ? "Estimated from application date" : "Recorded",
      urgency: o.urgency === "critical" ? "Critical" : "Overdue",
    })),
  };
}

function stageSection(result: ReportResult): Section {
  return {
    sheet: "Candidates by stage",
    title: "Candidates by stage",
    note: "In stage now, overdue, and days are right now. Estimated = no stage change recorded, so counted from the application date. Typical days is the middle value: half waited less, half waited more. With fewer than 5 candidates it shows Too few to show, or No data yet when there are none. Entered and backed out are in these dates.",
    columns: [
      { header: "Stage", key: "stage", weight: 120 },
      { header: "In stage now", key: "inStage", weight: 50, align: "right" },
      { header: "Overdue", key: "overdue", weight: 45, align: "right" },
      { header: "Overdue, estimated", key: "estimated", weight: 50, align: "right" },
      { header: "Typical days", key: "median", weight: 55, align: "right" },
      { header: "Average days", key: "avg", weight: 55, align: "right" },
      { header: "Days allowed", key: "limit", weight: 65, align: "right" },
      { header: "Entered", key: "entered", weight: 50, align: "right" },
      { header: "Backed out", key: "backedOut", weight: 55, align: "right" },
    ],
    rows: result.stageTable.map((s) => ({
      stage: s.label,
      inStage: s.inStageNow,
      overdue: s.stage === "DEPLOYED" ? null : s.overdue,
      estimated: s.stage === "DEPLOYED" ? null : s.overdueEstimated,
      median: valueOrNote(s.medianDaysInStage, s.typicalWaitSample),
      avg: valueOrNote(s.avgDaysInStage, s.typicalWaitSample),
      limit: s.stage === "DEPLOYED" ? "No limit" : s.stage === "CLIENT_ENDORSEMENT" ? "Depends on client" : s.slaDays,
      entered: s.entered,
      backedOut: s.backedOut,
    })),
  };
}

function recruiterSections(result: ReportResult): Section[] {
  const team = result.team ?? [];
  const sections: Section[] = [
    {
      sheet: "Recruiters",
      title: "Each recruiter's work",
      note: "Active applicants, overdue, and seats are right now. Overdue, estimated = no stage change recorded, so counted from the application date. Sent to client, starts, and backouts are in these dates. A rate or typical time based on fewer than 5 cases shows Too few to show, with the number of cases in parentheses, or No data yet when there are none.",
      columns: [
        { header: "Recruiter", key: "name", weight: 110 },
        { header: "Active applicants", key: "active", weight: 52, align: "right" },
        { header: "Overdue", key: "overdue", weight: 40, align: "right" },
        { header: "Overdue, estimated", key: "estimated", weight: 44, align: "right" },
        { header: "Open requests", key: "open", weight: 52, align: "right" },
        { header: "Seats needed", key: "seats", weight: 46, align: "right" },
        { header: "Seats filled", key: "filled", weight: 46, align: "right" },
        { header: "Seats filled (%)", key: "fill", weight: 52, align: "right" },
        { header: "Sent to client", key: "sent", weight: 48, align: "right" },
        { header: "New starts", key: "newStarts", weight: 50, align: "right" },
        { header: "Redeployed starts", key: "redeploy", weight: 58, align: "right" },
        { header: "Backed out", key: "backouts", weight: 48, align: "right" },
        { header: "Backout rate (%)", key: "backoutRate", weight: 56, align: "right" },
        { header: "Days to fill", key: "days", weight: 52, align: "right" },
      ],
      rows: team.map((t) => ({
        name: clean(t.name),
        active: t.active,
        overdue: t.overdue,
        estimated: t.overdueEstimated,
        open: t.openRequisitions,
        seats: t.requestedSeats,
        filled: t.filledSeats,
        fill: valueOrNote(t.fillRate, t.requestedSeats),
        sent: t.sentToClient,
        newStarts: t.newStarts,
        redeploy: t.redeployStarts,
        backouts: t.backouts,
        backoutRate: valueOrNote(t.backoutRate, t.backoutRateBase),
        days: valueOrNote(t.medianDaysToFill, t.daysToFillSample),
      })),
    },
  ];
  return sections;
}

function closureSections(result: ReportResult): Section[] {
  const c = result.closures;
  return [
    {
      sheet: "Closed applications",
      title: "Closed applications",
      note: "Applications closed in these dates. Rejected means we turned the applicant down. Backed out means the applicant dropped out. Talent pool and Archive are what was decided for the applicant afterwards. Not recorded means the record was closed before this choice was added.",
      columns: [
        { header: "Outcome", key: "outcome", weight: 120 },
        { header: "Total", key: "total", weight: 60, align: "right" },
        { header: "Talent pool", key: "talentPool", weight: 70, align: "right" },
        { header: "Archive", key: "archive", weight: 70, align: "right" },
        { header: "Not recorded", key: "notRecorded", weight: 80, align: "right" },
      ],
      rows: [
        { outcome: "Rejected", total: c.rejected.total, talentPool: c.rejected.talentPool, archive: c.rejected.archive, notRecorded: c.rejected.notRecorded },
        { outcome: "Backed out", total: c.backedOut.total, talentPool: c.backedOut.talentPool, archive: c.backedOut.archive, notRecorded: c.backedOut.notRecorded },
      ],
    },
    {
      sheet: "Why applicants were rejected",
      title: "Why applicants were rejected",
      note: "The most common reasons for rejecting an applicant in these dates, and the stage they were at.",
      columns: [
        { header: "Reason", key: "reason", weight: 200 },
        { header: "Applicants", key: "count", weight: 70, align: "right" },
      ],
      rows: [
        ...c.topRejectionReasons.map((r) => ({ reason: sentenceCase(r.reason), count: r.count })),
        ...c.rejectedByStage.map((s) => ({ reason: `Rejected at: ${s.label}`, count: s.count })),
      ],
    },
  ];
}

function backoutSection(detail: DeliveryDetail, admin: boolean): Section {
  return {
    sheet: "Why people backed out",
    title: "Why people backed out",
    note: "Everyone who left in these dates. \"Backed out after client review\" means they left once the client had seen them. \"Backed out before client review\" means they left earlier. Candidates the client turned down are not listed here.",
    columns: [
      { header: "Date", key: "date", weight: 52, align: "center" },
      { header: "When", key: "type", weight: 78 },
      { header: "Candidate", key: "candidate", weight: 100 },
      { header: "Job opening", key: "job", weight: 100 },
      { header: "Client", key: "client", weight: 85 },
      { header: "Client request", key: "request", weight: 100 },
      { header: "Stage", key: "stage", weight: 80 },
      { header: "Who ended it", key: "party", weight: 70 },
      { header: "Reason", key: "reason", weight: 100 },
      { header: "Did not show up", key: "noShow", weight: 46, align: "center" },
      ...(admin ? [{ header: "Recruiter", key: "recruiter", weight: 80 }] : []),
      { header: "Recorded by", key: "recordedBy", weight: 80 },
      { header: "Notes", key: "notes", weight: 140 },
    ],
    rows: detail.backouts.map((b) => ({
      date: date(b.occurredAt),
      type: POST_SELECTION.includes(b.stage) ? "Backed out after client review" : "Backed out before client review",
      candidate: clean(b.candidateName),
      job: clean(b.jobTitle),
      client: clean(b.clientName ?? ""),
      request: clean(b.mrfTitle ?? ""),
      stage: stageLabelOf(b.stage),
      party: PARTY_LABEL[b.party] ?? b.party,
      reason: backoutReasonLabel(b.reason),
      noShow: b.reason === "NO_SHOW" ? "Yes" : "",
      recruiter: clean(b.recruiterName),
      recordedBy: clean(b.recordedBy),
      notes: clean(b.notes ?? ""),
    })),
  };
}

function candidatesSection(detail: DeliveryDetail, admin: boolean): Section {
  return {
    sheet: "Active applicants",
    inPdf: false,
    title: "Active applicants right now",
    note: "Everyone still going through the stages right now. All rows except \"Waiting to start\" add up to the Active applicants number.",
    columns: [
      { header: "Application no.", key: "id", weight: 52, align: "center" },
      { header: "Candidate", key: "candidate", weight: 115 },
      { header: "Job opening", key: "job", weight: 115 },
      { header: "Client", key: "client", weight: 95 },
      { header: "Client request", key: "request", weight: 110 },
      ...(admin ? [{ header: "Recruiter", key: "recruiter", weight: 90 }] : []),
      { header: "Current stage", key: "stage", weight: 90 },
      { header: "Days in this stage", key: "days", weight: 50, align: "right" as const },
      { header: "Days allowed", key: "limit", weight: 45, align: "right" as const },
      { header: "Status", key: "status", weight: 85, align: "center" as const, badge: true },
    ],
    rows: detail.candidates.map((c) => ({
      id: `#${c.applicationId}`,
      candidate: clean(c.candidateName),
      job: clean(c.jobTitle),
      client: clean(c.clientName ?? ""),
      request: clean(c.mrfTitle ?? "No client request"),
      recruiter: clean(c.recruiterName),
      stage: c.stageLabel,
      days: c.daysInStage,
      limit: c.stage === "DEPLOYED" ? null : c.slaDays,
      status: CANDIDATE_STATUS_LABEL[c.status],
    })),
  };
}

async function receivedSection(filters: AnalyticsFilterDto, requestedBy: Requester, start: Date, end: Date): Promise<Section> {
  const scope = { role: isAdminUser(requestedBy) ? "ADMINISTRATOR" : TA, userId: requestedBy.id };
  const apps = await prisma.application.findMany({
    where: { jobPosting: buildJobClause(filters, scope) as any, createdAt: { gte: start, lte: end } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      // The rule-based match score the application page shows, not the AI estimate.
      candidateScores: {
        where: { status: { in: ["CALCULATED", "STALE"] } },
        orderBy: [{ calculatedAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { finalFitScore: true },
      },
      user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } },
      jobPosting: { select: { title: true, mrf: { select: { title: true, client: { select: { name: true } } } } } },
    },
  });
  return {
    sheet: "Applications received",
    inPdf: false,
    title: "Applications received in these dates",
    note: "Every application received in these dates, whatever its stage today. Someone who applied more than once appears once per application.",
    columns: [
      { header: "Application no.", key: "id", weight: 55, align: "center" },
      { header: "Candidate", key: "candidate", weight: 130 },
      { header: "Email", key: "email", weight: 140 },
      { header: "Job opening", key: "job", weight: 130 },
      { header: "Client", key: "client", weight: 100 },
      { header: "Client request", key: "request", weight: 120 },
      { header: "Stage today", key: "status", weight: 90, align: "center", badge: true },
      { header: "Match score", key: "score", weight: 50, align: "right" },
      { header: "Date applied", key: "received", weight: 58, align: "center" },
    ],
    rows: apps.map((a) => {
      const p = a.user.applicantProfile;
      return {
        id: `#${a.id}`,
        candidate: clean(p ? `${p.firstName} ${p.lastName}`.trim() : displayEmail(a.user.email) ?? ""),
        email: clean(displayEmail(a.user.email) ?? ""),
        job: clean(a.jobPosting?.title ?? ""),
        client: clean(a.jobPosting?.mrf?.client?.name ?? ""),
        request: clean(a.jobPosting?.mrf?.title ?? "No client request"),
        status: stageLabelOf(a.status),
        score: a.candidateScores[0] ? Number(a.candidateScores[0].finalFitScore).toFixed(1) : null,
        received: date(a.createdAt),
      };
    }),
  };
}

function startsSection(detail: DeliveryDetail, admin: boolean): Section {
  return {
    sheet: "Starts",
    title: "Starts in these dates",
    note: "Workers who started work in these dates. Days to fill = calendar days from the client request to the worker's first day.",
    columns: [
      { header: "Start date", key: "started", weight: 55, align: "center" },
      { header: "Worker", key: "worker", weight: 120 },
      { header: "Client", key: "client", weight: 110 },
      { header: "Client request", key: "request", weight: 120 },
      { header: "New or redeployed", key: "type", weight: 70, align: "center", badge: true },
      ...(admin ? [{ header: "Recruiter", key: "recruiter", weight: 90 }] : []),
      { header: "Work site", key: "site", weight: 90 },
      { header: "Status", key: "status", weight: 70, align: "center" as const, badge: true },
      { header: "Contract end", key: "end", weight: 58, align: "center" as const },
      { header: "Days to fill", key: "days", weight: 48, align: "right" as const },
    ],
    rows: detail.starts.map((s) => ({
      started: date(s.startedAt),
      worker: clean(s.workerName),
      client: clean(s.clientName),
      request: clean(s.mrfTitle ?? "No client request"),
      type: s.isRedeployment ? "Redeployed" : "New",
      recruiter: clean(s.recruiterName),
      site: clean(s.site ?? ""),
      status: sentenceCase(s.status),
      end: date(s.contractEnd),
      days: s.daysToFill,
    })),
  };
}

async function awaitingStartSection(filters: AnalyticsFilterDto, requestedBy: Requester, admin: boolean, now: Date): Promise<Section> {
  const owner = admin ? filters.recruiterId : requestedBy.id;
  const where: any = { status: "READY_FOR_DEPLOYMENT", actualStart: null };
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.mrfId) where.mrfId = filters.mrfId;
  if (filters.jobPostingId) where.application = { jobPostingId: filters.jobPostingId };
  if (owner) where.AND = [ownedWhere.deployment({ id: owner, role: TA })];

  const rows = await prisma.deployment.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      contractStart: true,
      site: true,
      client: { select: { name: true } },
      mrf: { select: { title: true, assignedTa: { select: { role: true, displayName: true, email: true, applicantProfile: { select: { firstName: true, lastName: true } } } } } },
      employee: { select: { user: { select: { role: true, displayName: true, email: true, applicantProfile: { select: { firstName: true, lastName: true } } } } } },
    },
  });
  const nameOf = (u: Parameters<typeof resolveUserName>[0]) => resolveUserName(u ? { ...u, email: displayEmail(u.email) } : u, "");
  return {
    sheet: "Waiting to start",
    title: "Hired, waiting to start",
    note: "People already hired who have not started work yet, right now. They fill a seat but are not counted as started.",
    columns: [
      { header: "Worker", key: "worker", weight: 130 },
      { header: "Client", key: "client", weight: 120 },
      { header: "Client request", key: "request", weight: 130 },
      ...(admin ? [{ header: "Recruiter", key: "recruiter", weight: 100 }] : []),
      { header: "Work site", key: "site", weight: 100 },
      { header: "Planned start date", key: "planned", weight: 65, align: "center" as const },
      { header: "Days overdue to start", key: "late", weight: 60, align: "right" as const },
    ],
    rows: rows.map((d) => ({
      worker: clean(nameOf(d.employee?.user)),
      client: clean(d.client?.name ?? ""),
      request: clean(d.mrf?.title ?? "No client request"),
      recruiter: clean(d.mrf?.assignedTa ? nameOf(d.mrf.assignedTa) : "No recruiter assigned"),
      site: clean(d.site ?? ""),
      planned: date(d.contractStart),
      late: d.contractStart ? Math.max(0, manilaDayDiff(d.contractStart, now)) : null,
    })),
  };
}

// ─────────────────────────────────────────────
// Report builders
// ─────────────────────────────────────────────
async function loadReport(requestedBy: Requester, filters: AnalyticsFilterDto) {
  const admin = isAdminUser(requestedBy);
  const { start, end } = parseDateRange(filters);
  const [data, filterSummary] = await Promise.all([
    admin ? getAdminReportData(filters) : getTAReportData(filters, { role: TA, userId: requestedBy.id }),
    describeFilters(filters, requestedBy, start, end),
  ]);
  return { admin, start, end, result: data.result as ReportResult, detail: data.detail, filterSummary };
}

async function buildPipelineModel(requestedBy: Requester, filters: AnalyticsFilterDto): Promise<ReportModel> {
  const { admin, start, end, result, detail, filterSummary } = await loadReport(requestedBy, filters);
  const received = await receivedSection(filters, requestedBy, start, end);
  // Admin rows carry the recruiter name from the shared detail; backouts get it from the same owner lookup.
  const sections: Section[] = [
    requestsSection(result, admin),
    overdueSection(detail, admin),
    stageSection(result),
    ...(admin ? recruiterSections(result) : []),
    backoutSection(detail, admin),
    ...closureSections(result),
    candidatesSection(detail, admin),
    received,
  ];
  return { kpis: kpisFor(result), sections, filterSummary };
}

async function buildDeploymentModel(requestedBy: Requester, filters: AnalyticsFilterDto): Promise<ReportModel> {
  const { admin, result, detail, filterSummary } = await loadReport(requestedBy, filters);
  const awaiting = await awaitingStartSection(filters, requestedBy, admin, new Date());
  const k = result.kpis;
  const kpis: Kpi[] = [
    metricKpi("starts", k.placementsStarted, `${k.newStarts} new, ${k.redeployStarts} redeployed`),
    metricKpi("seatsFilled", valueOrNote(k.fillRate, k.requestedSeats, pct), `${k.filledSeats} of ${k.requestedSeats} seats`),
    {
      label: "Seats still open",
      value: k.openSeats,
      detail: `${k.requisitions.open} open requests`,
      basis: "Right now",
      definition: "Seats the client asked for that no one has been hired for yet.",
    },
    {
      label: "Hired, waiting to start",
      value: awaiting.rows.length,
      detail: "Hired but not started yet",
      basis: "Right now",
      definition: "People already hired who fill a seat but have not had their first day of work yet.",
    },
    metricKpi(
      "daysToFill",
      valueOrNote(k.medianDaysToFill, k.daysToFillSample),
      k.daysToFillSample === 0 ? "No starts linked to a request" : `Typical of ${k.daysToFillSample} ${k.daysToFillSample === 1 ? "worker" : "workers"}`
    ),
    metricKpi("backoutRate", valueOrNote(k.backoutRate, k.backoutRateBase, pct), `${k.backoutsAfterClientReview} of ${k.backoutRateBase}`),
  ];
  return { kpis, sections: [startsSection(detail, admin), awaiting, requestsSection(result, admin)], filterSummary };
}

// ─────────────────────────────────────────────
// Writers
// ─────────────────────────────────────────────
const metaFor = (requestedBy: Requester, reportType: "PIPELINE" | "DEPLOYMENT", model: ReportModel): ReportMetadata =>
  getReportMetadata({ reportType, roleScope: roleScopeOf(requestedBy), requestedByEmail: requestedBy.email, filterSummary: model.filterSummary });

const cellText = (value: Cell): string => (value === null || value === undefined || value === "" ? "" : typeof value === "number" ? String(value) : value);

/**
 * Splits the page width by column weight, but never makes a column narrower than the longest word in its heading,
 * so a heading wraps between words instead of breaking a word in half. The extra room comes from the wider columns.
 */
function columnWidths(doc: PDFKit.PDFDocument, columns: Column[], contentWidth: number): number[] {
  doc.font("Helvetica-Bold").fontSize(7.5);
  const mins = columns.map((c) => Math.max(...c.header.toUpperCase().split(/\s+/).map((w) => doc.widthOfString(`${w} `))) + 12);
  const total = columns.reduce((sum, c) => sum + c.weight, 0);
  const widths = columns.map((c) => (c.weight / total) * contentWidth);
  for (let pass = 0; pass < 5; pass++) {
    const short = widths.reduce((sum, w, i) => sum + Math.max(0, mins[i] - w), 0);
    if (short <= 0.01) break;
    const spare = widths.reduce((sum, w, i) => sum + Math.max(0, w - mins[i]), 0);
    if (spare <= 0) break;
    const take = Math.min(short, spare);
    for (let i = 0; i < widths.length; i++) {
      if (widths[i] < mins[i]) widths[i] = mins[i];
      else widths[i] -= ((widths[i] - mins[i]) / spare) * take;
    }
  }
  return widths;
}

async function writePdf(meta: ReportMetadata, model: ReportModel): Promise<Buffer> {
  const doc = await createHRDocument({ orientation: "landscape" });
  renderCorporateHeader(doc, meta);
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  // Nothing is shortened: long labels and cells wrap onto extra lines so every word stays readable.
  renderSummaryKPIs(
    doc,
    model.kpis.map((k) => ({ label: k.label, value: k.value, subtext: k.detail, basis: k.basis, definition: k.definition }))
  );

  const longLists: string[] = [];
  for (const section of model.sections) {
    if (section.inPdf === false) {
      longLists.push(`${section.title} (${section.rows.length})`);
      continue;
    }
    const shown = section.rows.slice(0, PDF_ROW_LIMIT);
    const capNote =
      section.rows.length > shown.length ? ` Showing the first ${shown.length} of ${section.rows.length} rows here. The Excel file has all of them.` : "";
    renderSectionTitle(doc, `${section.title} (${section.rows.length})`, `${section.note ?? ""}${capNote}`.trim() || undefined);
    const widths = columnWidths(doc, section.columns, contentWidth);
    renderGridTable(doc, {
      columns: section.columns.map((c, i) => ({
        header: c.header,
        width: widths[i],
        align: c.align,
        badge: c.badge,
      })),
      rows: shown.map((row) =>
        section.columns.map((c) => cellText(row[c.key]))
      ),
    });
  }
  if (longLists.length > 0) {
    renderSectionTitle(doc, "More in the Excel file", `These full lists are too long to print here. Download the Excel file to see them: ${longLists.join("; ")}.`);
  }
  return renderFootersAndPagination(doc, meta);
}

async function writeXlsx(meta: ReportMetadata, model: ReportModel): Promise<Buffer> {
  const { workbook, worksheet } = await createHRExcelWorkbook(meta, "Summary");
  applySpreadsheetHeaderBlock(worksheet, meta);
  const kpiColumns: ExcelColumnDef[] = [
    { header: "What we count", key: "label", minWidth: 28 },
    { header: "Number", key: "value", minWidth: 12, align: "right" },
    { header: "Details", key: "detail", minWidth: 36 },
    { header: "Time window", key: "basis", minWidth: 16, align: "center" },
    { header: "What it means", key: "definition", minWidth: 60 },
  ];
  applyTableHeaders(worksheet, 8, kpiColumns);
  applyDataRowsAndFormatting(
    worksheet,
    8,
    kpiColumns,
    model.kpis.map((k) => ({ ...k }))
  );

  for (const section of model.sections) {
    const sheet = workbook.addWorksheet(section.sheet.replace(/[\\/*?[\]:]/g, " ").slice(0, 31), { properties: { defaultRowHeight: 20 } });
    sheet.getCell("A1").value = `${section.title} (${section.rows.length})`;
    sheet.getCell("A1").font = { name: "Arial", size: 11, bold: true, color: { argb: "FF0F172A" } };
    sheet.getCell("A2").value = section.rows.length === 0 ? "Nothing to show for the dates and filters you picked." : section.note ?? "";
    sheet.getCell("A2").font = { name: "Arial", size: 9, italic: true, color: { argb: "FF475569" } };
    const columns: ExcelColumnDef[] = section.columns.map((c) => ({
      header: c.header,
      key: c.key,
      minWidth: Math.max(10, Math.round(c.weight / 6)),
      align: c.align,
    }));
    applyTableHeaders(sheet, 3, columns);
    applyDataRowsAndFormatting(
      sheet,
      3,
      columns,
      section.rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "string" ? clean(v) : v])))
    );
  }
  return writeWorkbookToBuffer(workbook);
}

// ─────────────────────────────────────────────
// Public API (unchanged signatures). The layout follows the signed-in user; the optional override is ignored so a
// caller cannot ask for a wider report than the user may see.
// ─────────────────────────────────────────────
export const generatePipelineReportPDF = async (requestedBy: Requester, filters?: AnalyticsFilterDto, _override?: ReportRoleScope): Promise<Buffer> => {
  const model = await buildPipelineModel(requestedBy, filters ?? {});
  return writePdf(metaFor(requestedBy, "PIPELINE", model), model);
};

export const generatePipelineReportXLSX = async (requestedBy: Requester, filters?: AnalyticsFilterDto, _override?: ReportRoleScope): Promise<Buffer> => {
  const model = await buildPipelineModel(requestedBy, filters ?? {});
  return writeXlsx(metaFor(requestedBy, "PIPELINE", model), model);
};

export const generateDeploymentReportPDF = async (requestedBy: Requester, filters?: AnalyticsFilterDto, _override?: ReportRoleScope): Promise<Buffer> => {
  const model = await buildDeploymentModel(requestedBy, filters ?? {});
  return writePdf(metaFor(requestedBy, "DEPLOYMENT", model), model);
};

export const generateDeploymentReportXLSX = async (requestedBy: Requester, filters?: AnalyticsFilterDto, _override?: ReportRoleScope): Promise<Buffer> => {
  const model = await buildDeploymentModel(requestedBy, filters ?? {});
  return writeXlsx(metaFor(requestedBy, "DEPLOYMENT", model), model);
};

/** Exposed for tests: the data a report is built from, before it is drawn. */
export const __reportModels = { buildPipelineModel, buildDeploymentModel };
