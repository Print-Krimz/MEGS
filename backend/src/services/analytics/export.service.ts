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
  basis: "As of today" | "Within the dates";
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

const HEALTH_LABEL = { OVERDUE: "Past due date", AT_RISK: "Due soon", ON_TRACK: "On track", FILLED: "Completed" } as const;
const ATTENTION_LABEL: Record<Exclude<RequestAttention, null>, string> = {
  NO_OPENING: "No job post yet",
  NO_APPLICANTS: "No applicants yet",
  FIRST_STAGE_ONLY: "No one past first screening",
};
const CANDIDATE_STATUS_LABEL: Record<CandidateStatus, string> = {
  OVERDUE: "Late",
  OVERDUE_BY_AGE: "Maybe late",
  ON_TIME: "On time",
  CLOSED_OPENING: "Job post closed",
  AWAITING_START: "Waiting to start",
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
  const parts = [`Dates: ${manilaDateString(start)} to ${manilaDateString(end)}`];
  if (filters.clientId) parts.push(`Client: ${client?.name ?? "not available"}`);
  if (filters.mrfId) parts.push(`Client request: ${request?.title ?? "not available"}`);
  if (filters.jobPostingId) parts.push(`Job post: ${job?.title ?? "not available"}`);
  if (admin) {
    const name = recruiter ? `${recruiter.applicantProfile?.firstName ?? ""} ${recruiter.applicantProfile?.lastName ?? ""}`.trim() || recruiter.email : null;
    parts.push(filters.recruiterId ? `Recruiter: ${name ?? "not available"}` : "All recruiters");
  } else {
    parts.push("Only your own records");
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
      label: "Applicants in process",
      value: k.activeApplicants,
      detail: k.unlinkedApplicants > 0 ? `${k.unlinkedApplicants} applied to a job post with no client request` : "Still being processed today",
      basis: "As of today",
      definition: "People who applied and are still going through the steps. People already hired and waiting to start are not included.",
    },
    {
      label: "Open client requests",
      value: k.requisitions.open,
      detail: `${k.filledSeats} of ${k.requestedSeats} slots filled (${k.fillRate}%)`,
      basis: "As of today",
      definition: "Client requests that still have slots to fill. A slot counts as filled once someone is hired for it.",
    },
    {
      label: "Late applicants",
      value: k.overdueCandidates,
      detail: k.overdueEstimated > 0 ? `+${k.overdueEstimated} maybe late` : "Waited longer than allowed",
      basis: "As of today",
      definition: "Applicants who have stayed in one step longer than the allowed number of days. \"Maybe late\" means we only know their application date, so the wait is a guess.",
    },
    {
      label: "Workers who started",
      value: k.placementsStarted,
      detail: `${k.newStarts} new, ${k.redeployStarts} returning`,
      basis: "Within the dates",
      definition: "Workers who actually started work within the dates. A returning worker sent to a new client is counted once.",
    },
    {
      label: "Backed out after client review",
      value: k.backoutsAfterClientReview,
      detail: `${k.backoutsAfterClientReview} of ${k.backoutRateBase} (${k.backoutRate}%)`,
      basis: "Within the dates",
      definition: "Applicants who backed out after the client already saw them, compared with those people plus the workers who started.",
    },
    {
      label: "Withdrew before client review",
      value: result.backouts.withdrawals,
      detail: `${result.backouts.noShows} did not show up`,
      basis: "Within the dates",
      definition: "Applicants who withdrew before the client saw them. Applicants the client turned down are not counted here.",
    },
  ];
  return [...list, ...extra];
}

function requestsSection(result: ReportResult, admin: boolean): Section {
  const columns: Column[] = [
    { header: "Client request", key: "title", weight: 120 },
    { header: "Client", key: "client", weight: 95 },
    ...(admin ? [{ header: "Recruiter", key: "owner", weight: 90 }] : []),
    { header: "Slots needed", key: "headcount", weight: 46, align: "right" as const },
    { header: "Slots filled", key: "filled", weight: 46, align: "right" as const },
    { header: "Slots open", key: "open", weight: 44, align: "right" as const },
    { header: "In process", key: "pipeline", weight: 48, align: "right" as const },
    { header: "Late", key: "overdue", weight: 38, align: "right" as const },
    { header: "Total applicants", key: "applicants", weight: 56, align: "right" as const },
    { header: "Status", key: "status", weight: 62, align: "center" as const, badge: true },
    { header: "Due date", key: "due", weight: 58, align: "center" as const },
    { header: "What to check", key: "attention", weight: 95 },
  ];
  return {
    sheet: "Client requests",
    title: "Client requests",
    note: "Requests still open, plus any completed within the dates. In process = applicants still going through the steps. Late = applicants who waited too long. Due date = when the client wants the slots filled.",
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
    sheet: "Late applicants",
    title: "Late applicants",
    note: "Applicants who stayed in one step longer than allowed. \"Sure\" cases come first. \"Maybe late\" means no step change was recorded, so days are counted from the application date and may be higher than the real wait.",
    columns: [
      { header: "Applicant", key: "candidate", weight: 120 },
      { header: "Job post", key: "job", weight: 115 },
      { header: "Client", key: "client", weight: 95 },
      ...(admin ? [{ header: "Recruiter", key: "recruiter", weight: 90 }] : []),
      { header: "Current step", key: "stage", weight: 90 },
      { header: "Days in this step", key: "days", weight: 60, align: "right" as const },
      { header: "Days allowed", key: "limit", weight: 52, align: "right" as const },
      { header: "Days late", key: "over", weight: 48, align: "right" as const },
      { header: "How sure", key: "basis", weight: 90 },
      { header: "Level", key: "urgency", weight: 60, align: "center" as const, badge: true },
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
      basis: o.estimated ? "Maybe late (based on application date)" : "Sure (step change recorded)",
      urgency: o.urgency === "critical" ? "Very late" : "Late",
    })),
  };
}

function stageSection(result: ReportResult): Section {
  return {
    sheet: "Time per step",
    title: "How long each step takes",
    note: "People now, late, and days are as of today. Maybe late = no step change recorded, so counted from the application date. Usual days = the middle value (half took less, half took more). Moved in and backed out are within the dates.",
    columns: [
      { header: "Step", key: "stage", weight: 120 },
      { header: "People now", key: "inStage", weight: 50, align: "right" },
      { header: "Late", key: "overdue", weight: 45, align: "right" },
      { header: "Maybe late", key: "estimated", weight: 50, align: "right" },
      { header: "Usual days", key: "median", weight: 55, align: "right" },
      { header: "Average days", key: "avg", weight: 55, align: "right" },
      { header: "Days allowed", key: "limit", weight: 65, align: "right" },
      { header: "Moved in", key: "entered", weight: 50, align: "right" },
      { header: "Backed out", key: "backedOut", weight: 55, align: "right" },
    ],
    rows: result.stageTable.map((s) => ({
      stage: s.label,
      inStage: s.inStageNow,
      overdue: s.stage === "DEPLOYED" ? null : s.overdue,
      estimated: s.stage === "DEPLOYED" ? null : s.overdueEstimated,
      median: s.medianDaysInStage,
      avg: s.avgDaysInStage,
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
      note: "Applicants, late, and slots are as of today. Maybe late = no step change recorded, so counted from the application date. Sent to client, started, and backed out are within the dates. Usual days to fill = the middle value.",
      columns: [
        { header: "Recruiter", key: "name", weight: 110 },
        { header: "Applicants in process", key: "active", weight: 52, align: "right" },
        { header: "Late", key: "overdue", weight: 40, align: "right" },
        { header: "Maybe late", key: "estimated", weight: 44, align: "right" },
        { header: "Open client requests", key: "open", weight: 52, align: "right" },
        { header: "Slots needed", key: "seats", weight: 46, align: "right" },
        { header: "Slots filled", key: "filled", weight: 46, align: "right" },
        { header: "% filled", key: "fill", weight: 42, align: "right" },
        { header: "Sent to client", key: "sent", weight: 48, align: "right" },
        { header: "New workers started", key: "newStarts", weight: 50, align: "right" },
        { header: "Returning workers started", key: "redeploy", weight: 58, align: "right" },
        { header: "Backed out", key: "backouts", weight: 48, align: "right" },
        { header: "% backed out", key: "backoutRate", weight: 50, align: "right" },
        { header: "Usual days to fill", key: "days", weight: 52, align: "right" },
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

function closureSections(result: ReportResult): Section[] {
  const c = result.closures;
  return [
    {
      sheet: "Closed applications",
      title: "Closed applications",
      note: "Applications closed within the dates. Rejected means we turned the applicant down. Backed out means the applicant dropped out. Talent pool and Archive are what was decided for the applicant afterwards. Not recorded is for older records closed before this choice existed.",
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
      note: "The most common reasons for rejecting an applicant within the dates, and the step they were at.",
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
    sheet: "People who backed out",
    title: "People who backed out",
    note: "Everyone who backed out or withdrew within the dates. \"After client review\" means they backed out after the client had already seen them. \"Before client review\" means they withdrew earlier. Applicants the client turned down are not listed here.",
    columns: [
      { header: "Date", key: "date", weight: 52, align: "center" },
      { header: "When", key: "type", weight: 78 },
      { header: "Applicant", key: "candidate", weight: 100 },
      { header: "Job post", key: "job", weight: 100 },
      { header: "Client", key: "client", weight: 85 },
      { header: "Client request", key: "request", weight: 100 },
      { header: "Step", key: "stage", weight: 80 },
      { header: "Who ended it", key: "party", weight: 70 },
      { header: "Reason", key: "reason", weight: 100 },
      { header: "Did not show up", key: "noShow", weight: 46, align: "center" },
      ...(admin ? [{ header: "Recruiter", key: "recruiter", weight: 80 }] : []),
      { header: "Recorded by", key: "recordedBy", weight: 80 },
      { header: "Notes", key: "notes", weight: 140 },
    ],
    rows: detail.backouts.map((b) => ({
      date: date(b.occurredAt),
      type: POST_SELECTION.includes(b.stage) ? "After client review" : "Before client review",
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
    sheet: "Applicants in process",
    inPdf: false,
    title: "Applicants in process today",
    note: "Everyone still going through the steps today. All rows except \"Waiting to start\" add up to the Applicants in process number.",
    columns: [
      { header: "Application no.", key: "id", weight: 52, align: "center" },
      { header: "Applicant", key: "candidate", weight: 115 },
      { header: "Job post", key: "job", weight: 115 },
      { header: "Client", key: "client", weight: 95 },
      { header: "Client request", key: "request", weight: 110 },
      ...(admin ? [{ header: "Recruiter", key: "recruiter", weight: 90 }] : []),
      { header: "Current step", key: "stage", weight: 90 },
      { header: "Days in this step", key: "days", weight: 50, align: "right" as const },
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
    title: "Applications received within the dates",
    note: "Every application received within the dates, whatever its step today. Someone who applied more than once appears once per application.",
    columns: [
      { header: "Application no.", key: "id", weight: 55, align: "center" },
      { header: "Applicant", key: "candidate", weight: 130 },
      { header: "Email", key: "email", weight: 140 },
      { header: "Job post", key: "job", weight: 130 },
      { header: "Client", key: "client", weight: 100 },
      { header: "Client request", key: "request", weight: 120 },
      { header: "Step today", key: "status", weight: 90, align: "center", badge: true },
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
    sheet: "Workers who started",
    title: "Workers who started within the dates",
    note: "Workers who actually started work within the dates. Days to fill = calendar days from the client request to the worker's first day.",
    columns: [
      { header: "Start date", key: "started", weight: 55, align: "center" },
      { header: "Worker", key: "worker", weight: 120 },
      { header: "Client", key: "client", weight: 110 },
      { header: "Client request", key: "request", weight: 120 },
      { header: "New or returning", key: "type", weight: 70, align: "center", badge: true },
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
      type: s.isRedeployment ? "Returning" : "New",
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
    return full || displayEmail(u?.email) || "";
  };
  return {
    sheet: "Waiting to start",
    title: "Hired, waiting to start",
    note: "People already hired who have not started work yet, as of today. They fill a slot but are not counted as started.",
    columns: [
      { header: "Worker", key: "worker", weight: 130 },
      { header: "Client", key: "client", weight: 120 },
      { header: "Client request", key: "request", weight: 130 },
      ...(admin ? [{ header: "Recruiter", key: "recruiter", weight: 100 }] : []),
      { header: "Work site", key: "site", weight: 100 },
      { header: "Planned start date", key: "planned", weight: 65, align: "center" as const },
      { header: "Days late to start", key: "late", weight: 60, align: "right" as const },
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
  return { kpis: kpisFor(result, admin), sections, filterSummary };
}

async function buildDeploymentModel(requestedBy: Requester, filters: AnalyticsFilterDto): Promise<ReportModel> {
  const { admin, result, detail, filterSummary } = await loadReport(requestedBy, filters);
  const awaiting = await awaitingStartSection(filters, requestedBy, admin, new Date());
  const k = result.kpis;
  const kpis: Kpi[] = [
    {
      label: "Workers who started",
      value: k.placementsStarted,
      detail: `${k.newStarts} new, ${k.redeployStarts} returning`,
      basis: "Within the dates",
      definition: "Workers who actually started work within the dates. A returning worker sent to a new client is counted once.",
    },
    {
      label: "Slots filled",
      value: `${k.fillRate}%`,
      detail: `${k.filledSeats} of ${k.requestedSeats} slots`,
      basis: "As of today",
      definition: "Slots with someone hired, out of all slots on open requests and requests completed within the dates.",
    },
    { label: "Slots still open", value: k.openSeats, detail: `${k.requisitions.open} open client requests`, basis: "As of today", definition: "Slots the client asked for that no one has been hired for yet." },
    {
      label: "Hired, waiting to start",
      value: awaiting.rows.length,
      detail: "Hired but not started yet",
      basis: "As of today",
      definition: "People already hired who fill a slot but have not had their first day of work yet.",
    },
    {
      label: "Usual days to fill",
      value: k.medianDaysToFill === null ? "—" : k.medianDaysToFill,
      detail: k.daysToFillSample === 0 ? "No starts linked to a request" : `Middle value of ${k.daysToFillSample} ${k.daysToFillSample === 1 ? "worker" : "workers"}`,
      basis: "Within the dates",
      definition: "Calendar days from the client request to the worker's first day, using the middle value. 0 means the same day.",
    },
    {
      label: "Backed out after client review",
      value: k.backoutRateBase === 0 ? "—" : `${k.backoutRate}%`,
      detail: `${k.backoutsAfterClientReview} of ${k.backoutRateBase}`,
      basis: "Within the dates",
      definition: "Applicants who backed out after the client already saw them, compared with those people plus the workers who started.",
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
    model.kpis.map((k) => ({ label: k.label, value: k.value, subtext: k.detail }))
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
    { header: "Counted", key: "basis", minWidth: 16, align: "center" },
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
