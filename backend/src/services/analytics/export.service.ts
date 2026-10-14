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
import { STAGE_ROWS, manilaDayDiff, stageRowFor } from "./metric-definitions.js";
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
  /** A shorter heading for the PDF, where columns are narrow. Excel keeps the full heading. */
  short?: string;
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
  basis: "Now" | "In period";
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
  NO_OPENING: "No opening posted",
  NO_APPLICANTS: "No applicants",
  FIRST_STAGE_ONLY: "First stage only",
};
const CANDIDATE_STATUS_LABEL: Record<CandidateStatus, string> = {
  OVERDUE: "Overdue",
  OVERDUE_BY_AGE: "Overdue (age only)",
  ON_TIME: "On time",
  CLOSED_OPENING: "Closed opening",
  AWAITING_START: "Awaiting start",
};
const PARTY_LABEL: Record<string, string> = { APPLICANT: "Applicant", CLIENT: "Client", AGENCY: "MEGS (agency)" };
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
          select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } },
        })
      : null,
  ]);
  const parts = [`Period: ${manilaDateString(start)} to ${manilaDateString(end)}`];
  if (filters.clientId) parts.push(`Client: ${client?.name ?? "not available"}`);
  if (filters.mrfId) parts.push(`Request: ${request?.title ?? "not available"}`);
  if (filters.jobPostingId) parts.push(`Opening: ${job?.title ?? "not available"}`);
  if (admin) {
    const name = recruiter ? `${recruiter.applicantProfile?.firstName ?? ""} ${recruiter.applicantProfile?.lastName ?? ""}`.trim() || recruiter.email : null;
    parts.push(filters.recruiterId ? `Recruiter: ${name ?? "not available"}` : "All recruiters");
  } else {
    parts.push("Your records only");
  }
  return parts.join(" | ");
}

// ─────────────────────────────────────────────
// KPI and table definitions (shared by PDF and Excel)
// ─────────────────────────────────────────────
function kpisFor(result: ReportResult, admin: boolean, extra: Kpi[] = []): Kpi[] {
  const k = result.kpis;
  const list: Kpi[] = [
    {
      label: "Active applicants",
      value: k.activeApplicants,
      detail: k.unlinkedApplicants > 0 ? `${k.unlinkedApplicants} on openings with no request` : "In the pipeline now",
      basis: "Now",
      definition: "Candidates between application and start, not yet deployed. Excludes anyone awaiting a start date.",
    },
    {
      label: "Open requests",
      value: k.requisitions.open,
      detail: `${k.filledSeats} of ${k.requestedSeats} seats filled (${k.fillRate}%)`,
      basis: "Now",
      definition: "Requests with seats still to fill. Seats count as filled while a placement holds them.",
    },
    {
      label: "Overdue candidates",
      value: k.overdueCandidates,
      detail: k.overdueEstimated > 0 ? `+${k.overdueEstimated} by application age only` : "Past their stage limit",
      basis: "Now",
      definition: "Candidates past the allowed days for their stage, counted from a recorded stage change. Age-only cases are listed apart.",
    },
    {
      label: "Starts",
      value: k.placementsStarted,
      detail: `${k.newStarts} new, ${k.redeployStarts} redeployed`,
      basis: "In period",
      definition: "Workers whose actual start date falls in the period. A redeployed worker counts once.",
    },
    {
      label: "Backouts",
      value: k.backoutsAfterClientReview,
      detail: `${k.backoutsAfterClientReview} of ${k.backoutRateBase} (${k.backoutRate}%)`,
      basis: "In period",
      definition: "Candidates who left after client review, out of those plus starts that came from an application.",
    },
    {
      label: "Withdrawals",
      value: result.backouts.withdrawals,
      detail: `${result.backouts.noShows} recorded as no-show`,
      basis: "In period",
      definition: "Candidates who left before the client reviewed them. Client declines are counted separately.",
    },
  ];
  return [...list, ...extra];
}

function requestsSection(result: ReportResult, admin: boolean): Section {
  const columns: Column[] = [
    { header: "Request", key: "title", weight: 135 },
    { header: "Client", key: "client", weight: 105 },
    ...(admin ? [{ header: "Assigned to", key: "owner", weight: 100 }] : []),
    { header: "Seats", key: "headcount", weight: 36, align: "right" as const },
    { header: "Filled", key: "filled", weight: 38, align: "right" as const },
    { header: "Open", key: "open", weight: 34, align: "right" as const },
    { header: "Pipeline", key: "pipeline", weight: 50, align: "right" as const },
    { header: "Overdue", key: "overdue", weight: 48, align: "right" as const },
    { header: "Applicants", key: "applicants", weight: 58, align: "right" as const },
    { header: "Status", key: "status", weight: 55, align: "center" as const, badge: true },
    { header: "Due", key: "due", weight: 56, align: "center" as const },
    { header: "Needs attention", key: "attention", weight: 95 },
  ];
  return {
    sheet: "Requests",
    title: "Client requests",
    note: "Open requests, plus any filled in the period. Seats filled come from placements, never from the request status. Overdue counts candidates; Due is the target date.",
    columns,
    rows: result.requests.map((r) => ({
      title: clean(r.title),
      client: clean(r.clientName),
      owner: clean(r.ownerName),
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
    note: "Verified cases come first. Age-only cases have no recorded stage change, so their days run from the application date and may overstate the wait.",
    columns: [
      { header: "Candidate", key: "candidate", weight: 120 },
      { header: "Job opening", key: "job", weight: 115 },
      { header: "Client", key: "client", weight: 95 },
      ...(admin ? [{ header: "Recruiter", key: "recruiter", weight: 90 }] : []),
      { header: "Stage", key: "stage", weight: 90 },
      { header: "Days in stage", key: "days", weight: 66, align: "right" as const },
      { header: "Limit", key: "limit", weight: 40, align: "right" as const },
      { header: "Days over", key: "over", weight: 56, align: "right" as const },
      { header: "Basis", key: "basis", weight: 105 },
      { header: "Urgency", key: "urgency", weight: 55, align: "center" as const, badge: true },
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
      basis: o.estimated ? "Application age only" : "Verified stage change",
      urgency: o.urgency === "critical" ? "Critical" : "Overdue",
    })),
  };
}

function stageSection(result: ReportResult): Section {
  return {
    sheet: "Stage durations",
    title: "Stage durations",
    note: "In stage, overdue and days are as of today. Age only means overdue by application age with no recorded stage change. Entered and backed out cover the period.",
    columns: [
      { header: "Stage", key: "stage", weight: 120 },
      { header: "In stage", key: "inStage", weight: 50, align: "right" },
      { header: "Overdue", key: "overdue", weight: 50, align: "right" },
      { header: "Age only", key: "estimated", weight: 55, align: "right" },
      { header: "Median days", key: "median", weight: 60, align: "right" },
      { header: "Average days", key: "avg", weight: 60, align: "right" },
      { header: "Limit (days)", key: "limit", weight: 70, align: "right" },
      { header: "Entered", key: "entered", weight: 50, align: "right" },
      { header: "Backed out", key: "backedOut", weight: 55, align: "right" },
    ],
    rows: result.stageTable.map((s) => ({
      stage: s.label,
      inStage: s.inStageNow,
      overdue: s.stage === "DEPLOYED" ? null : s.overdue,
      estimated: s.stage === "DEPLOYED" ? null : s.overdueEstimated,
      median: s.medianDaysInStage,
      avg: s.avgDaysInStage,
      limit: s.stage === "DEPLOYED" ? "None" : s.stage === "CLIENT_ENDORSEMENT" ? "Per client" : s.slaDays,
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
      title: "Recruiter workload and results",
      note: "Workload (active, overdue, seats) is as of today. Age only is overdue by application age with no recorded stage change. Sent, started and backed out cover the period.",
      columns: [
        { header: "Recruiter", key: "name", weight: 120 },
        { header: "Active", key: "active", weight: 40, align: "right" },
        { header: "Overdue", key: "overdue", weight: 44, align: "right" },
        { header: "Age only", key: "estimated", weight: 50, align: "right" },
        { header: "Open requests", short: "Open req.", key: "open", weight: 52, align: "right" },
        { header: "Seats", key: "seats", weight: 40, align: "right" },
        { header: "Filled", key: "filled", weight: 40, align: "right" },
        { header: "Fill %", key: "fill", weight: 40, align: "right" },
        { header: "Sent to client", short: "Sent", key: "sent", weight: 50, align: "right" },
        { header: "New starts", short: "New", key: "newStarts", weight: 48, align: "right" },
        { header: "Redeployed", short: "Redeploy", key: "redeploy", weight: 52, align: "right" },
        { header: "Backed out", short: "Backed", key: "backouts", weight: 48, align: "right" },
        { header: "Backout %", short: "Back %", key: "backoutRate", weight: 48, align: "right" },
        { header: "Median days to fill", short: "Days to fill", key: "days", weight: 58, align: "right" },
      ],
      rows: team.map((t) => ({
        name: clean(t.name),
        active: t.active,
        overdue: t.overdue,
        estimated: t.overdueEstimated,
        open: t.openRequisitions,
        seats: t.requestedSeats,
        filled: t.filledSeats,
        fill: t.fillRate,
        sent: t.sentToClient,
        newStarts: t.newStarts,
        redeploy: t.redeployStarts,
        backouts: t.backouts,
        backoutRate: t.backoutRate,
        days: t.medianDaysToFill,
      })),
    },
  ];
  return sections;
}

function exceptionsSection(result: ReportResult, admin: boolean): Section {
  const k = result.kpis;
  const count = (attention: RequestAttention) => result.requests.filter((r) => r.attention === attention).length;
  const rows: Record<string, Cell>[] = [
    { item: "Critical overdue candidates", count: k.criticalCandidates, meaning: "Waited at least twice the stage limit. Includes candidates counted by application age only." },
    { item: "Open requests with no opening posted", count: count("NO_OPENING"), meaning: "Nothing is advertised for these requests yet." },
    { item: "Open requests with no applicants", count: count("NO_APPLICANTS"), meaning: "An opening exists but nobody has applied." },
    { item: "Open requests with first-stage applicants only", count: count("FIRST_STAGE_ONLY"), meaning: "Applicants exist but none has passed initial review." },
    { item: "Candidates on openings with no request", count: k.unlinkedApplicants, meaning: "No request counts these candidates, so request pipeline counts understate them." },
    { item: "Candidates on closed openings", count: k.closedOpenings, meaning: "The opening is closed or its request is filled or cancelled. Not counted as overdue." },
    { item: "Requests marked filled with no placement", count: k.staleFilledRequisitions, meaning: "Left out of seat counts. Usually leftover test or cleanup data." },
  ];
  return {
    sheet: "Exceptions",
    title: "Operational exceptions",
    columns: [
      { header: "Item", key: "item", weight: 260 },
      { header: "Count", key: "count", weight: 60, align: "right" },
      { header: "What it means", key: "meaning", weight: 430 },
    ],
    rows,
  };
}

function backoutSection(detail: DeliveryDetail, admin: boolean): Section {
  return {
    sheet: "Withdrawals and backouts",
    title: "Withdrawals and backouts",
    note: "Every record in the period. After client review counts as a backout; before client review counts as a withdrawal. Client declines are not listed here.",
    columns: [
      { header: "Date", key: "date", weight: 52, align: "center" },
      { header: "Type", key: "type", weight: 78 },
      { header: "Candidate", key: "candidate", weight: 100 },
      { header: "Job opening", key: "job", weight: 100 },
      { header: "Client", key: "client", weight: 85 },
      { header: "Request", key: "request", weight: 100 },
      { header: "Stage", key: "stage", weight: 80 },
      { header: "Who pulled out", key: "party", weight: 70 },
      { header: "Reason", key: "reason", weight: 100 },
      { header: "No-show", key: "noShow", weight: 42, align: "center" },
      ...(admin ? [{ header: "Recruiter", key: "recruiter", weight: 80 }] : []),
      { header: "Recorded by", key: "recordedBy", weight: 80 },
      { header: "Notes", key: "notes", weight: 140 },
    ],
    rows: detail.backouts.map((b) => ({
      date: date(b.occurredAt),
      type: POST_SELECTION.includes(b.stage) ? "Backout (after client review)" : "Withdrawal (before client review)",
      candidate: clean(b.candidateName),
      job: clean(b.jobTitle),
      client: clean(b.clientName ?? ""),
      request: clean(b.mrfTitle ?? ""),
      stage: stageLabelOf(b.stage),
      party: PARTY_LABEL[b.party] ?? b.party,
      reason: sentenceCase(b.reason),
      noShow: b.reason === "NO_SHOW" ? "Yes" : "",
      recruiter: clean(b.recruiterName),
      recordedBy: clean(b.recordedBy),
      notes: clean(b.notes ?? ""),
    })),
  };
}

function candidatesSection(detail: DeliveryDetail, admin: boolean): Section {
  return {
    sheet: "Active candidates",
    inPdf: false,
    title: "Candidates in the pipeline now",
    note: "Every candidate currently in the pipeline. Rows other than 'Awaiting start' add up to the Active applicants figure.",
    columns: [
      { header: "Application", key: "id", weight: 52, align: "center" },
      { header: "Candidate", key: "candidate", weight: 115 },
      { header: "Job opening", key: "job", weight: 115 },
      { header: "Client", key: "client", weight: 95 },
      { header: "Request", key: "request", weight: 110 },
      ...(admin ? [{ header: "Recruiter", key: "recruiter", weight: 90 }] : []),
      { header: "Stage", key: "stage", weight: 90 },
      { header: "Days in stage", key: "days", weight: 50, align: "right" as const },
      { header: "Limit", key: "limit", weight: 36, align: "right" as const },
      { header: "Status", key: "status", weight: 85, align: "center" as const, badge: true },
    ],
    rows: detail.candidates.map((c) => ({
      id: `#${c.applicationId}`,
      candidate: clean(c.candidateName),
      job: clean(c.jobTitle),
      client: clean(c.clientName ?? ""),
      request: clean(c.mrfTitle ?? "Not linked to a request"),
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
      aiScore: true,
      createdAt: true,
      user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } },
      jobPosting: { select: { title: true, mrf: { select: { title: true, client: { select: { name: true } } } } } },
    },
  });
  return {
    sheet: "Received in period",
    inPdf: false,
    title: "Applications received in the period",
    note: "Every application received in the period, whatever its status today. A returning applicant appears once per attempt.",
    columns: [
      { header: "Application", key: "id", weight: 55, align: "center" },
      { header: "Candidate", key: "candidate", weight: 130 },
      { header: "Email", key: "email", weight: 140 },
      { header: "Job opening", key: "job", weight: 130 },
      { header: "Client", key: "client", weight: 100 },
      { header: "Request", key: "request", weight: 120 },
      { header: "Status now", key: "status", weight: 90, align: "center", badge: true },
      { header: "AI match", key: "score", weight: 45, align: "right" },
      { header: "Received", key: "received", weight: 58, align: "center" },
    ],
    rows: apps.map((a) => {
      const p = a.user.applicantProfile;
      return {
        id: `#${a.id}`,
        candidate: clean(p ? `${p.firstName} ${p.lastName}`.trim() : a.user.email),
        email: clean(a.user.email),
        job: clean(a.jobPosting?.title ?? ""),
        client: clean(a.jobPosting?.mrf?.client?.name ?? ""),
        request: clean(a.jobPosting?.mrf?.title ?? "Not linked to a request"),
        status: stageLabelOf(a.status),
        score: a.aiScore !== null && a.aiScore !== undefined ? `${a.aiScore}%` : null,
        received: date(a.createdAt),
      };
    }),
  };
}

function startsSection(detail: DeliveryDetail, admin: boolean): Section {
  return {
    sheet: "Starts in period",
    title: "Starts in the period",
    note: "Workers whose actual start date falls in the period. The row count is the Starts figure. Days to fill is calendar days from request to start.",
    columns: [
      { header: "Started", key: "started", weight: 55, align: "center" },
      { header: "Worker", key: "worker", weight: 120 },
      { header: "Client", key: "client", weight: 110 },
      { header: "Request", key: "request", weight: 120 },
      { header: "Type", key: "type", weight: 70, align: "center", badge: true },
      ...(admin ? [{ header: "Recruiter", key: "recruiter", weight: 90 }] : []),
      { header: "Site", key: "site", weight: 90 },
      { header: "Status", key: "status", weight: 70, align: "center" as const, badge: true },
      { header: "Contract end", key: "end", weight: 58, align: "center" as const },
      { header: "Days to fill", key: "days", weight: 48, align: "right" as const },
    ],
    rows: detail.starts.map((s) => ({
      started: date(s.startedAt),
      worker: clean(s.workerName),
      client: clean(s.clientName),
      request: clean(s.mrfTitle ?? "No request"),
      type: s.isRedeployment ? "Redeployment" : "New",
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
      mrf: { select: { title: true, assignedTa: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } } } },
      employee: { select: { user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } } } },
    },
  });
  const nameOf = (u?: { email: string; applicantProfile?: { firstName: string | null; lastName: string | null } | null } | null) => {
    const full = `${u?.applicantProfile?.firstName ?? ""} ${u?.applicantProfile?.lastName ?? ""}`.trim();
    return full || u?.email || "";
  };
  return {
    sheet: "Awaiting start",
    title: "Placements awaiting a start",
    note: "Placements made but not yet started, as of today. They hold a seat but are not yet counted as starts.",
    columns: [
      { header: "Worker", key: "worker", weight: 130 },
      { header: "Client", key: "client", weight: 120 },
      { header: "Request", key: "request", weight: 130 },
      ...(admin ? [{ header: "Recruiter", key: "recruiter", weight: 100 }] : []),
      { header: "Site", key: "site", weight: 100 },
      { header: "Planned start", key: "planned", weight: 65, align: "center" as const },
      { header: "Days past plan", key: "late", weight: 60, align: "right" as const },
    ],
    rows: rows.map((d) => ({
      worker: clean(nameOf(d.employee?.user)),
      client: clean(d.client?.name ?? ""),
      request: clean(d.mrf?.title ?? "No request"),
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
    exceptionsSection(result, admin),
    backoutSection(detail, admin),
    candidatesSection(detail, admin),
    received,
  ];
  return { kpis: kpisFor(result, admin), sections, filterSummary };
}

async function buildDeploymentModel(requestedBy: Requester, filters: AnalyticsFilterDto): Promise<ReportModel> {
  const { admin, result, detail, filterSummary } = await loadReport(requestedBy, filters);
  const awaiting = await awaitingStartSection(filters, requestedBy, admin, new Date());
  const k = result.kpis;
  const kpis: Kpi[] = [
    {
      label: "Starts",
      value: k.placementsStarted,
      detail: `${k.newStarts} new, ${k.redeployStarts} redeployed`,
      basis: "In period",
      definition: "Workers whose actual start date falls in the period. A redeployed worker counts once.",
    },
    {
      label: "Seats filled",
      value: `${k.fillRate}%`,
      detail: `${k.filledSeats} of ${k.requestedSeats} seats`,
      basis: "Now",
      definition: "Seats a placement holds, out of seats requested on open requests and requests filled in the period.",
    },
    { label: "Open seats", value: k.openSeats, detail: `${k.requisitions.open} open requests`, basis: "Now", definition: "Requested seats that no placement holds yet." },
    {
      label: "Awaiting start",
      value: awaiting.rows.length,
      detail: "Placed, not yet started",
      basis: "Now",
      definition: "Placements made that hold a seat but have no actual start date yet.",
    },
    {
      label: "Days to fill",
      value: k.medianDaysToFill === null ? "—" : k.medianDaysToFill,
      detail: k.daysToFillSample === 0 ? "No starts with a request" : `Median of ${k.daysToFillSample} ${k.daysToFillSample === 1 ? "start" : "starts"}`,
      basis: "In period",
      definition: "Calendar days from the request being opened to the worker starting. 0 means the same day.",
    },
    {
      label: "Backout rate",
      value: k.backoutRateBase === 0 ? "—" : `${k.backoutRate}%`,
      detail: `${k.backoutsAfterClientReview} of ${k.backoutRateBase}`,
      basis: "In period",
      definition: "Backouts after client review, out of those backouts plus starts that came from an application.",
    },
  ];
  return { kpis, sections: [startsSection(detail, admin), awaiting, requestsSection(result, admin)], filterSummary };
}

// ─────────────────────────────────────────────
// Writers
// ─────────────────────────────────────────────
const metaFor = (requestedBy: Requester, reportType: "PIPELINE" | "DEPLOYMENT", model: ReportModel): ReportMetadata =>
  getReportMetadata({ reportType, roleScope: roleScopeOf(requestedBy), requestedByEmail: requestedBy.email, filterSummary: model.filterSummary });

const cellText = (value: Cell): string => (value === null || value === undefined || value === "" ? "" : typeof value === "number" ? String(value) : value);

/** Shortens text to fit a column so it never wraps into the next row. */
function fit(doc: PDFKit.PDFDocument, text: string, width: number, font: string, size: number): string {
  doc.font(font).fontSize(size);
  const room = width - 3; // slack so rounding never tips a cell into wrapping
  if (doc.widthOfString(text) <= room) return text;
  let out = text;
  while (out.length > 1 && doc.widthOfString(`${out}...`) > room) out = out.slice(0, -1);
  return `${out.trimEnd()}...`;
}

async function writePdf(meta: ReportMetadata, model: ReportModel): Promise<Buffer> {
  const doc = createHRDocument({ orientation: "landscape" });
  renderCorporateHeader(doc, meta);
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const kpiCount = Math.min(model.kpis.length, 7);
  const cardWidth = (contentWidth - (kpiCount - 1) * 8) / kpiCount - 16;
  renderSummaryKPIs(
    doc,
    model.kpis.map((k) => ({ label: k.label, value: k.value, subtext: fit(doc, k.detail, cardWidth, "Helvetica", 6.5) }))
  );

  const longLists: string[] = [];
  for (const section of model.sections) {
    if (section.inPdf === false) {
      longLists.push(`${section.title} (${section.rows.length})`);
      continue;
    }
    const shown = section.rows.slice(0, PDF_ROW_LIMIT);
    const capNote =
      section.rows.length > shown.length ? ` Showing the first ${shown.length} of ${section.rows.length} rows here; the Excel report lists all of them.` : "";
    renderSectionTitle(doc, `${section.title} (${section.rows.length})`, `${section.note ?? ""}${capNote}`.trim() || undefined);
    const total = section.columns.reduce((sum, c) => sum + c.weight, 0);
    const widths = section.columns.map((c) => (c.weight / total) * contentWidth);
    renderGridTable(doc, {
      columns: section.columns.map((c, i) => ({
        header: fit(doc, (c.short ?? c.header).toUpperCase(), widths[i] - 8, "Helvetica-Bold", 7.5),
        width: widths[i],
        align: c.align,
        badge: c.badge,
      })),
      rows: shown.map((row) =>
        section.columns.map((c, i) => fit(doc, cellText(row[c.key]), widths[i] - (c.badge ? 14 : 8), c.badge ? "Helvetica-Bold" : "Helvetica", c.badge ? 6.5 : 7.5))
      ),
    });
  }
  if (longLists.length > 0) {
    renderSectionTitle(doc, "Also in the Excel report", `Full lists that are too long to print: ${longLists.join("; ")}.`);
  }
  return renderFootersAndPagination(doc, meta);
}

async function writeXlsx(meta: ReportMetadata, model: ReportModel): Promise<Buffer> {
  const { workbook, worksheet } = createHRExcelWorkbook(meta, "Summary");
  applySpreadsheetHeaderBlock(worksheet, meta);
  const kpiColumns: ExcelColumnDef[] = [
    { header: "Metric", key: "label", minWidth: 24 },
    { header: "Value", key: "value", minWidth: 12, align: "right" },
    { header: "Counts", key: "detail", minWidth: 36 },
    { header: "Basis", key: "basis", minWidth: 12, align: "center" },
    { header: "How it is worked out", key: "definition", minWidth: 60 },
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
    sheet.getCell("A2").value = section.rows.length === 0 ? "No matching records for these filters." : section.note ?? "";
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
