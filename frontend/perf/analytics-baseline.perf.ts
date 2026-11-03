/**
 * Analytics overhaul BEFORE-state capture for /admin/analytics (team leader) and /ta/analytics (recruiter).
 *
 * Per role and state (default, empty, loading, error, long) at 375, 768, 1280 and 1440 px:
 * - full-page screenshot (docs/reports/analytics-overhaul-2026-11/baseline/screenshots/<role>-<state>-<width>.png)
 * - document scrollWidth vs clientWidth, plus the elements that stick out past the viewport
 * - console and page errors, HTTP errors, unmocked /api/ calls, aborted external requests
 * - at 1280 px only: keyboard focus order for 25 Tab presses, and axe-core results
 *
 * Mocks: every /api/ request is answered by page.route. Unmocked /api/ requests get a 404 and are listed,
 * never forwarded. Requests to any other host (the hosted backend, Supabase, Turnstile) are aborted, except
 * the preview origin. Nothing logs in: mockShell sets the same localStorage session the e2e specs use.
 *
 * Run (from frontend/, after freezing the build once):
 *   PERF_DIST=<frozen dist dir> npx playwright test -c perf/analytics-baseline.config.ts
 *
 * Optional overrides (unset = the defaults above, so the baseline run is unchanged):
 *   ANALYTICS_BASELINE_OUT=<dir>   output folder (screenshots/ and measurements.json are written under it)
 *   ANALYTICS_ROLES=admin          comma list of roles to capture
 *   ANALYTICS_WIDTHS=375,1280      comma list of widths to capture
 *   ANALYTICS_AXE_ALL_WIDTHS=1     run axe at every captured width (default: 1280 only)
 *   ANALYTICS_EXTRAS=1            also capture the design-review shots at 1280: admin "How these are counted" open,
 *                                 admin Export menu open, recruiter keyboard focus after 8 Tab presses
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { test, type Browser, type Page, type Route } from "@playwright/test";
import { json, mockShell } from "../e2e/helpers/mock-shell";

const PREVIEW_HOST = "127.0.0.1:4173";
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR =
  process.env.ANALYTICS_BASELINE_OUT ?? path.resolve(here, "..", "..", "docs", "reports", "analytics-overhaul-2026-11", "baseline");
const SHOT_DIR = path.join(OUT_DIR, "screenshots");
mkdirSync(SHOT_DIR, { recursive: true });

const ALL_WIDTHS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
  { width: 1440, height: 900 },
] as const;
const FOCUS_WIDTH = 1280;
const FOCUS_STEPS = 25;

/** Comma list from an env var, or the fallback when the variable is unset. */
function envList(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : fallback;
}
const WIDTHS = ALL_WIDTHS.filter((w) => envList("ANALYTICS_WIDTHS", ALL_WIDTHS.map((x) => String(x.width))).includes(String(w.width)));
const AXE_ALL_WIDTHS = process.env.ANALYTICS_AXE_ALL_WIDTHS === "1";

type Role = "admin" | "recruiter";
type StateName = "default" | "empty" | "loading" | "error" | "long";
const ROLES = envList("ANALYTICS_ROLES", ["admin", "recruiter"]) as Role[];
const STATES: StateName[] = ["default", "empty", "loading", "error", "long"];

// ---------------------------------------------------------------------------
// Fixtures. Same shapes as e2e/analytics-delivery.spec.ts (the frontend contract), extended with long lists.
// Rates are 0-100, as the backend sends them.
// ---------------------------------------------------------------------------

const dateRange = { startDate: "2026-10-07", endDate: "2026-10-13", days: 7 };
const recruiterName = (i: number) => `Recruiter ${String(i + 1).padStart(2, "0")}`;

const filterOptions = {
  clients: [{ id: 1, name: "Acme Industrial Corp" }],
  mrfs: [{ id: 10, title: "10x Industrial Electricians", clientId: 1 }],
  jobPostings: [{ id: 101, title: "Industrial Electrician", mrfId: 10, postedById: "ta-1" }],
  recruiters: [
    { id: "ta-1", name: "Alice Recruiter", email: "alice@megs.ph" },
    { id: "ta-2", name: "Bob Recruiter", email: "bob@megs.ph" },
  ],
  stages: [],
};

const longFilterOptions = {
  ...filterOptions,
  recruiters: Array.from({ length: 32 }, (_, i) => ({ id: `ta-${i}`, name: recruiterName(i), email: `recruiter${i + 1}@megs.ph` })),
};

const backouts = {
  withdrawals: 1,
  backouts: 3,
  byParty: { APPLICANT: 2, CLIENT: 1, AGENCY: 1 },
  byStage: [
    { stage: "CLIENT_ENDORSEMENT", label: "Client review", APPLICANT: 1, CLIENT: 0, AGENCY: 0, total: 1 },
    { stage: "COMPLIANCE", label: "Requirements", APPLICANT: 1, CLIENT: 1, AGENCY: 1, total: 3 },
  ],
  topReasons: [
    { reason: "ACCEPTED_OTHER_OFFER", count: 2 },
    { reason: "CLIENT_CANCELLED_REQUEST", count: 1 },
  ],
  noShows: 1,
  byClient: [
    { clientName: "Gamma Logistics", count: 2 },
    { clientName: "Beta Fabrication", count: 1 },
  ],
  byRequest: [{ mrfId: 4, title: "25x Warehouse Staff", clientName: "Gamma Logistics", count: 2 }],
  recent: [
    {
      applicationId: 801,
      candidateName: "Ramon Gomez",
      jobTitle: "Forklift Operator",
      clientName: "Gamma Logistics",
      mrfId: 4,
      stage: "COMPLIANCE",
      party: "APPLICANT",
      reason: "ACCEPTED_OTHER_OFFER",
      occurredAt: "2026-10-10T02:00:00.000Z",
    },
  ],
};

const emptyBackouts = {
  withdrawals: 0,
  backouts: 0,
  noShows: 0,
  byParty: { APPLICANT: 0, CLIENT: 0, AGENCY: 0 },
  byStage: [],
  topReasons: [],
  byClient: [],
  byRequest: [],
  recent: [],
};

const stage = (key: string, label: string, over: Record<string, unknown>) => ({
  stage: key,
  label,
  inStageNow: 0,
  overdue: 0,
  overdueEstimated: 0,
  entered: 0,
  backedOut: 0,
  avgDaysInStage: null,
  medianDaysInStage: null,
  // Sample behind the average: the number of candidates who entered the stage (the backend nulls the average under 5).
  typicalWaitSample: Number(over.entered ?? 0),
  slaDays: 7,
  ...over,
});

// Labels are the backend's STAGE_ROWS (services/analytics/metric-definitions.ts). Under 5 samples the average is null.
const stageTable = [
  stage("APPLIED", "Submitted", { inStageNow: 30, overdue: 2, entered: 24, backedOut: 1, avgDaysInStage: 3.2, medianDaysInStage: 3 }),
  stage("INITIAL_SCREENING", "Initial screening", { inStageNow: 15, entered: 12, avgDaysInStage: 2.1, medianDaysInStage: 2 }),
  stage("CLIENT_ENDORSEMENT", "Client review", { inStageNow: 5, overdue: 3, entered: 5, avgDaysInStage: 6.4, medianDaysInStage: 6, slaDays: 5 }),
  stage("FINAL_INTERVIEW", "Final interview", { slaDays: 5 }),
  stage("COMPLIANCE", "Requirements", { inStageNow: 54, overdue: 20, overdueEstimated: 6, entered: 8, backedOut: 3, avgDaysInStage: 9.5, medianDaysInStage: 8, slaDays: 14 }),
  stage("CONTRACT_SIGNING", "Contract signing", { inStageNow: 2, entered: 2, slaDays: 7 }),
  stage("DEPLOYED", "Deployed", { inStageNow: 1, entered: 1, slaDays: 7 }),
];

const zeroStageTable = stageTable.map((s) => ({
  ...s,
  inStageNow: 0,
  overdue: 0,
  overdueEstimated: 0,
  entered: 0,
  backedOut: 0,
  avgDaysInStage: null,
  medianDaysInStage: null,
  typicalWaitSample: 0,
}));

const kpis = {
  fillRate: 62.5,
  filledSeats: 25,
  requestedSeats: 40,
  openSeats: 15,
  requisitions: { total: 3, open: 3, overdue: 1, atRisk: 1, filled: 0 },
  placementsStarted: 6,
  newStarts: 4,
  redeployStarts: 2,
  medianDaysToFill: 18.5,
  daysToFillSample: 5,
  backoutsAfterClientReview: 3,
  backoutRate: 33.3,
  backoutRateBase: 9,
  // Open requests that are overdue or at risk: the OVERDUE and AT_RISK rows in `requests` below.
  lateRequests: 2,
  // overdueCandidates + overdueEstimated.
  overdueTotal: 31,
  activeApplicants: 107,
  overdueCandidates: 25,
  overdueEstimated: 6,
  closedOpenings: 2,
  staleFilledRequisitions: 28,
  criticalCandidates: 1,
  unlinkedApplicants: 0,
};

const zeroKpis = {
  ...kpis,
  lateRequests: 0,
  overdueTotal: 0,
  fillRate: 0,
  filledSeats: 0,
  requestedSeats: 0,
  openSeats: 0,
  requisitions: { total: 0, open: 0, overdue: 0, atRisk: 0, filled: 0 },
  placementsStarted: 0,
  newStarts: 0,
  redeployStarts: 0,
  medianDaysToFill: null,
  daysToFillSample: 0,
  backoutsAfterClientReview: 0,
  backoutRate: 0,
  backoutRateBase: 0,
  activeApplicants: 0,
  overdueCandidates: 0,
  overdueEstimated: 0,
  closedOpenings: 0,
  staleFilledRequisitions: 0,
  criticalCandidates: 0,
  unlinkedApplicants: 0,
};

// Recruiter numbers: the recruiter's own work. Only lateRequests differs from the team numbers (one of the two late requests is theirs).
const taKpis = { ...kpis, lateRequests: 1 };
// The backend sends a rate as null when its base is under 5 (formatSampled prints "Not enough data (n=...)").
const zeroTaKpis = { ...zeroKpis, backoutRate: null };
const longTaKpis = {
  ...taKpis,
  lateRequests: 10,
  overdueCandidates: 36,
  overdueEstimated: 4,
  overdueTotal: 40,
  backoutsAfterClientReview: 1,
  backoutRate: null,
  backoutRateBase: 2,
  medianDaysToFill: null,
  daysToFillSample: 3,
};

const request = (over: Record<string, unknown>) => ({
  mrfId: 1,
  title: "Request",
  clientId: 1,
  clientName: "Acme Industrial Corp",
  status: "OPEN",
  ownerId: "ta-1",
  ownerName: "Alice Recruiter",
  headcount: 10,
  filled: 3,
  openSeats: 7,
  pipeline: 2,
  overdueCandidates: 0,
  targetFillDate: null,
  daysRemaining: null,
  jobCount: 1,
  applicantCount: 6,
  attention: null,
  health: "ON_TRACK",
  backoutsInPeriod: 0,
  ...over,
});

const requests = [
  request({ mrfId: 3, title: "5x Certified Welders", clientId: 2, clientName: "Beta Fabrication", ownerId: "ta-2", ownerName: "Bob Recruiter", headcount: 5, filled: 1, openSeats: 4, pipeline: 1, overdueCandidates: 1, targetFillDate: "2026-10-01T00:00:00.000Z", daysRemaining: -12, health: "OVERDUE", backoutsInPeriod: 1 }),
  request({ mrfId: 10, title: "10x Industrial Electricians", headcount: 10, filled: 6, openSeats: 4, pipeline: 2, targetFillDate: "2026-10-18T00:00:00.000Z", daysRemaining: 5, health: "AT_RISK", backoutsInPeriod: 2 }),
  request({ mrfId: 4, title: "25x Warehouse Staff", clientId: 3, clientName: "Gamma Logistics", headcount: 25, filled: 18, openSeats: 7, pipeline: 12, targetFillDate: "2026-11-20T00:00:00.000Z", daysRemaining: 38 }),
];

const teamRow = (over: Record<string, unknown>) => ({
  recruiterId: "ta-0",
  name: "Recruiter",
  active: 0,
  overdue: 0,
  overdueEstimated: 0,
  openRequisitions: 0,
  requestedSeats: 0,
  filledSeats: 0,
  fillRate: 0,
  sentToClient: 0,
  newStarts: 0,
  redeployStarts: 0,
  placed: 0,
  backouts: 0,
  backoutRate: 0,
  backoutRateBase: 0,
  medianDaysToFill: null,
  daysToFillSample: 0,
  ...over,
});

const trend = {
  granularity: "day",
  points: Array.from({ length: 7 }, (_, i) => {
    const newStarts = i === 6 ? 4 : 0;
    const redeployStarts = i === 6 ? 2 : 0;
    return {
      start: `2026-10-${String(7 + i).padStart(2, "0")}`,
      label: `Oct ${7 + i}`,
      starts: newStarts + redeployStarts,
      newStarts,
      redeployStarts,
      backouts: i === 6 ? 3 : 0,
      withdrawals: i === 4 ? 1 : 0,
    };
  }),
};

const zeroTrend = {
  granularity: "day",
  points: trend.points.map((p) => ({ ...p, starts: 0, newStarts: 0, redeployStarts: 0, backouts: 0, withdrawals: 0 })),
};

// Reason labels are sent by the backend next to each reason code (both roles).
const REASON_LABELS: Record<string, string> = {
  ACCEPTED_OTHER_OFFER: "Accepted another offer",
  CLIENT_CANCELLED_REQUEST: "Client cancelled the request",
};
const withReasonLabels = (b: typeof backouts) => ({
  ...b,
  topReasons: b.topReasons.map((r) => ({ ...r, label: REASON_LABELS[r.reason] ?? r.reason })),
  recent: b.recent.map((r) => ({ ...r, reasonLabel: REASON_LABELS[r.reason] ?? r.reason })),
});
const adminBackouts = withReasonLabels(backouts);
const taBackouts = withReasonLabels(backouts);

const taUser = {
  id: "ta-1",
  email: "alice@megs.ph",
  role: "TALENT_ACQUISITION",
  isActive: true,
  applicantProfile: { firstName: "Alice", lastName: "Recruiter" },
};
const adminUser = {
  id: "admin-1",
  email: "admin@megs.ph",
  role: "ADMINISTRATOR",
  isActive: true,
  applicantProfile: { firstName: "Team", lastName: "Leader" },
};

// Admin (team leader view)
const adminDashboard = {
  dateRange,
  kpis,
  team: [
    teamRow({ recruiterId: "ta-1", name: "Alice Recruiter", active: 40, overdue: 12, overdueEstimated: 3, openRequisitions: 2, requestedSeats: 35, filledSeats: 24, fillRate: 68.6, sentToClient: 9, newStarts: 2, redeployStarts: 2, placed: 4, backouts: 2, backoutRate: 33.3, backoutRateBase: 6, medianDaysToFill: 20, daysToFillSample: 6 }),
    teamRow({ recruiterId: "ta-2", name: "Bob Recruiter", active: 22, overdue: 1, overdueEstimated: 0, openRequisitions: 1, requestedSeats: 5, filledSeats: 1, fillRate: 20, sentToClient: 4, newStarts: 2, redeployStarts: 0, placed: 2, backouts: 1, backoutRate: 33.3, backoutRateBase: 3, medianDaysToFill: 15, daysToFillSample: 2 }),
    teamRow({ recruiterId: "ta-3", name: "naheje4599@37xiao.com", active: 12, overdue: 0, overdueEstimated: 0, openRequisitions: 3, requestedSeats: 30, filledSeats: 18, fillRate: 60, newStarts: 6, placed: 6, backouts: 0, backoutRate: 0, backoutRateBase: 8, medianDaysToFill: 6, daysToFillSample: 6 }),
    teamRow({ recruiterId: "ta-4", name: "Juan Dela Cruz", active: 9, overdue: 2, overdueEstimated: 0, openRequisitions: 0, requestedSeats: 0, filledSeats: 0, fillRate: null, placed: 0, backoutRate: null, backoutRateBase: 0, medianDaysToFill: null, daysToFillSample: 0 }),
    teamRow({ recruiterId: "ta-5", name: "Rita Santos", active: 14, overdue: 5, overdueEstimated: 1, openRequisitions: 2, requestedSeats: 20, filledSeats: 3, fillRate: 15, placed: 3, backouts: 3, backoutRate: 50, backoutRateBase: 6, medianDaysToFill: 24, daysToFillSample: 5 }),
  ],
  unassigned: { applicants: 45, overdue: 12, overdueEstimated: 3, requests: 0, requestedSeats: 0, oldestWaitDays: 41 },
  requests,
  trend,
  backouts: adminBackouts,
  clientDecisions: { accepted: 15, declined: 2 },
  stageTable,
  stuck: [
    { applicationId: 801, candidateName: "Ramon Gomez", jobTitle: "Forklift Operator", clientName: "Gamma Logistics", mrfId: 4, recruiterId: "ta-1", recruiterName: "Alice Recruiter", stage: "COMPLIANCE", stageLabel: "Requirements", daysInStage: 31, slaDays: 14, daysOver: 17, urgency: "critical", estimated: false },
    { applicationId: 802, candidateName: "Lito Santos", jobTitle: "Welder", clientName: "Beta Fabrication", mrfId: 3, recruiterId: "ta-2", recruiterName: "Bob Recruiter", stage: "FINAL_INTERVIEW", stageLabel: "Final interview", daysInStage: 9, slaDays: 5, daysOver: 4, urgency: "overdue", estimated: true },
  ],
  stuckTotal: 2,
  filterOptions,
};

const emptyAdmin = {
  ...adminDashboard,
  kpis: zeroKpis,
  team: [],
  unassigned: { applicants: 0, overdue: 0, overdueEstimated: 0, requests: 0, requestedSeats: 0, oldestWaitDays: null },
  requests: [],
  trend: zeroTrend,
  backouts: emptyBackouts,
  clientDecisions: { accepted: 0, declined: 0 },
  stageTable: zeroStageTable,
  stuck: [],
  stuckTotal: 0,
};

const longAdmin = {
  ...adminDashboard,
  kpis: { ...kpis, lateRequests: 12 },
  team: Array.from({ length: 32 }, (_, i) =>
    teamRow({
      recruiterId: `ta-${i}`,
      name: recruiterName(i),
      active: 4 + ((i * 7) % 40),
      overdue: i % 5,
      overdueEstimated: i % 2,
      openRequisitions: i % 3,
      requestedSeats: 5 + i,
      filledSeats: i % 9,
      fillRate: i % 3 === 0 ? 0 : 20 + (i % 6) * 10,
      sentToClient: i % 4,
      newStarts: i % 3,
      redeployStarts: i % 2,
      placed: i % 4,
      backouts: i % 3,
      backoutRate: i % 3 === 0 ? 0 : 33.3,
      backoutRateBase: 3 + (i % 6),
      medianDaysToFill: 10 + (i % 12),
      daysToFillSample: 1 + (i % 10),
    })
  ),
  requests: Array.from({ length: 84 }, (_, i) =>
    request({
      mrfId: i + 1,
      title: `Request ${i + 1}`,
      clientId: (i % 12) + 1,
      clientName: `Client ${(i % 12) + 1}`,
      ownerId: `ta-${i % 32}`,
      ownerName: recruiterName(i % 32),
      headcount: 10 + (i % 15),
      filled: i % 9,
      openSeats: 10 + (i % 15) - (i % 9),
      pipeline: i % 5,
      health: i < 5 ? "OVERDUE" : i < 12 ? "AT_RISK" : "ON_TRACK",
      targetFillDate: "2026-11-20T00:00:00.000Z",
      daysRemaining: 18 + (i % 30),
      backoutsInPeriod: i % 3 === 0 ? 1 : 0,
    })
  ),
  stuck: Array.from({ length: 30 }, (_, i) => ({
    applicationId: 900 + i,
    candidateName: `Candidate ${String(i + 1).padStart(2, "0")}`,
    jobTitle: "Industrial Electrician",
    clientName: `Client ${(i % 12) + 1}`,
    mrfId: (i % 12) + 1,
    recruiterId: `ta-${i % 32}`,
    recruiterName: recruiterName(i % 32),
    stage: "COMPLIANCE",
    stageLabel: "Requirements",
    daysInStage: 15 + (i % 20),
    slaDays: 14,
    daysOver: 1 + (i % 20),
    urgency: i < 3 ? "critical" : "overdue",
    estimated: i % 7 === 0,
  })),
  stuckTotal: 30,
  filterOptions: longFilterOptions,
};

// Recruiter (TA, own work only)
const taDashboard = {
  dateRange,
  kpis: taKpis,
  requests: requests.filter((r) => r.ownerId === "ta-1"),
  stageTable,
  dropOff: [
    { stage: "APPLIED", label: "Submitted", reached: 24, inStage: 6, movedForward: 12, backedOut: 1, rejected: 5 },
    { stage: "INITIAL_SCREENING", label: "Initial screening", reached: 18, inStage: 8, movedForward: 8, backedOut: 0, rejected: 2 },
    { stage: "COMPLIANCE", label: "Requirements", reached: 8, inStage: 4, movedForward: 1, backedOut: 3, rejected: 0 },
  ],
  backouts: taBackouts,
  clientDecisions: { accepted: 15, declined: 2 },
  stuck: [
    { applicationId: 811, candidateName: "Mario Reyes", jobTitle: "Industrial Electrician", clientName: "Acme Industrial Corp", mrfId: 10, recruiterId: "ta-1", recruiterName: "You", stage: "COMPLIANCE", stageLabel: "Requirements", daysInStage: 20, slaDays: 14, daysOver: 6, urgency: "overdue", estimated: false },
  ],
  stuckTotal: 25,
  pendingActionsTotal: 41,
  pendingActions: [
    {
      id: "interview-901",
      type: "INITIAL_INTERVIEW",
      title: "Initial Interview Pending Evaluation",
      candidateName: "Ramon Gomez",
      jobTitle: "Forklift Operator",
      applicationId: 801,
      urgency: "HIGH",
      deadline: "2026-10-14T00:00:00.000Z",
      targetUrl: "/ta/interviews",
      createdAt: "2026-10-01T00:00:00.000Z",
    },
    ...[
      { id: "cs-1", type: "CLIENT_ENDORSEMENT", title: "Client Review Overdue (1d / 5d SLA) · Supercell", candidateName: "Zara Algat", jobTitle: "Software Developers", urgency: "HIGH", agingDays: 7 },
      { id: "ct-2", type: "CONTRACT_SIGNING", title: "Confirm start: contract signing", candidateName: "Anthan Del Rosario", jobTitle: "Automotive & Transport Operations Staff", urgency: "MEDIUM", agingDays: 6 },
      { id: "cl-3", type: "COMPLIANCE_REVIEW", title: "Review Clearance: Barangay Clearance", candidateName: "Nathaniel Cruz", jobTitle: "Automotive & Transport Operations Staff", urgency: "MEDIUM", deadline: new Date(Date.now() - 8 * 86_400_000).toISOString() },
      { id: "in-4", type: "INITIAL_INTERVIEW", title: "Initial Interview Pending Evaluation", candidateName: "Marco Dixon", jobTitle: "Warehouse Forklift Operators", urgency: "MEDIUM", deadline: new Date(Date.now() + 5 * 86_400_000).toISOString() },
      { id: "fi-5", type: "FINAL_INTERVIEW", title: "Final interview today", candidateName: "Jaselle Cruz", jobTitle: "Warehouse Forklift Operators", urgency: "NORMAL", deadline: new Date().toISOString() },
      { id: "sc-6", type: "START_CONFIRMATION", title: "Logistics Personnel", candidateName: "Dana Reyes", jobTitle: "Meridian Island Logistics Corporation", urgency: "NORMAL", agingDays: 16 },
    ].map((x) => ({ ...x, applicationId: 800, targetUrl: "/ta/applications/800", createdAt: "2026-10-01T00:00:00.000Z" })),
  ],
  filterOptions,
};

const emptyTa = {
  ...taDashboard,
  kpis: zeroTaKpis,
  requests: [],
  stageTable: zeroStageTable,
  dropOff: [],
  backouts: emptyBackouts,
  clientDecisions: { accepted: 0, declined: 0 },
  stuck: [],
  stuckTotal: 0,
  pendingActionsTotal: 0,
  pendingActions: [],
};

const longTa = {
  ...taDashboard,
  kpis: longTaKpis,
  requests: Array.from({ length: 60 }, (_, i) =>
    request({
      mrfId: 200 + i,
      title: `Request ${i + 1}`,
      clientId: (i % 12) + 1,
      clientName: `Client ${(i % 12) + 1}`,
      headcount: 10 + (i % 15),
      filled: i % 9,
      openSeats: 10 + (i % 15) - (i % 9),
      pipeline: i % 5,
      jobCount: 1 + (i % 3),
      applicantCount: i % 12,
      health: i < 4 ? "OVERDUE" : i < 10 ? "AT_RISK" : "ON_TRACK",
      targetFillDate: "2026-11-20T00:00:00.000Z",
      daysRemaining: 18 + (i % 30),
    })
  ),
  stuck: Array.from({ length: 40 }, (_, i) => ({
    applicationId: 1000 + i,
    candidateName: `Candidate ${String(i + 1).padStart(2, "0")}`,
    jobTitle: "Industrial Electrician",
    clientName: `Client ${(i % 12) + 1}`,
    mrfId: (i % 12) + 1,
    recruiterId: "ta-1",
    recruiterName: "You",
    stage: "COMPLIANCE",
    stageLabel: "Requirements",
    daysInStage: 15 + (i % 20),
    slaDays: 14,
    daysOver: 1 + (i % 20),
    urgency: i < 3 ? "critical" : "overdue",
    estimated: i % 7 === 0,
  })),
  stuckTotal: 40,
  pendingActionsTotal: 40,
  pendingActions: Array.from({ length: 40 }, (_, i) => ({
    id: `interview-${950 + i}`,
    type: "INITIAL_INTERVIEW",
    title: "Initial Interview Pending Evaluation",
    candidateName: `Applicant ${String(i + 1).padStart(2, "0")}`,
    jobTitle: "Forklift Operator",
    applicationId: 950 + i,
    urgency: i < 5 ? "HIGH" : "MEDIUM",
    deadline: "2026-10-14T00:00:00.000Z",
    targetUrl: "/ta/interviews",
    createdAt: "2026-10-01T00:00:00.000Z",
  })),
};

// ---------------------------------------------------------------------------
// Routing per role and state
// ---------------------------------------------------------------------------

// Fields added by the 2026-11-02 mockup redesign. Older fixtures lack them, so every dashboard response gets them.
const REDESIGN_FIELDS = {
  previousPeriod: { startDate: "2026-09-30", endDate: "2026-10-06", placementsStarted: 6, newStarts: 4, redeployStarts: 2, medianDaysToFill: 17.7, daysToFillSample: 9, backoutRate: 30, backoutRateBase: 10 },
  clientReview: {
    avgDays: 6.2,
    sample: 23,
    clients: [
      { clientId: 1, clientName: "Acme Industrial Corp", inReview: 8, avgDays: 7.2, limitDays: 5, overdue: 5 },
      { clientId: 2, clientName: "Beta Fabrication", inReview: 6, avgDays: 5.8, limitDays: 4, overdue: 3 },
      { clientId: 3, clientName: "Cebu Logistics Hub", inReview: 5, avgDays: 4.1, limitDays: 5, overdue: 1 },
      { clientId: 4, clientName: "Delta Foods Inc.", inReview: 3, avgDays: null, limitDays: 3, overdue: 1 },
    ],
  },
  dueSoon: [
    { applicationId: 9001, candidateName: "Barry Chua", jobTitle: "Machine Operator", clientName: "Acme Industrial Corp", mrfId: 1, recruiterId: "ta-1", recruiterName: "Sarah Kim", stage: "INITIAL_SCREENING", stageLabel: "Initial screening", daysInStage: 3, slaDays: 3, daysOver: 0, urgency: "overdue", estimated: false, lastActivityAt: null, lastNote: null, daysLeft: 0 },
    { applicationId: 9002, candidateName: "Zaral Alogid", jobTitle: "Welder", clientName: "Beta Fabrication", mrfId: 2, recruiterId: "ta-1", recruiterName: "Sarah Kim", stage: "FINAL_INTERVIEW", stageLabel: "Final interview", daysInStage: 4, slaDays: 5, daysOver: 0, urgency: "overdue", estimated: false, lastActivityAt: null, lastNote: null, daysLeft: 1 },
  ],
  dueSoonTotal: 2,
};
const REDESIGN_EMPTY = {
  previousPeriod: { ...REDESIGN_FIELDS.previousPeriod, placementsStarted: 0, newStarts: 0, redeployStarts: 0, medianDaysToFill: null, daysToFillSample: 0, backoutRate: null, backoutRateBase: 0 },
  clientReview: { avgDays: null, sample: 0, clients: [] },
  dueSoon: [],
  dueSoonTotal: 0,
};

interface RolePage {
  url: string;
  user: Record<string, unknown>;
  dashboardPath: string;
  dashboard: Record<"default" | "empty" | "long", unknown>;
  filtersPath: string;
  filters: Record<"default" | "long", unknown>;
  pending?: { path: string; data: Record<"default" | "empty" | "long", unknown> };
  /** Endpoints the app shell (nav badges) calls on every page of this role. Answered the same in every state. */
  shell?: Array<{ path: string; data: unknown }>;
}

// Nav-badge queries from the TA layout (TALayout.tsx). Zero counts, so the badges do not change between states.
const TA_SHELL_MOCKS: NonNullable<RolePage["shell"]> = [
  {
    path: "/api/ta/compliance/interviews",
    data: { items: [], total: 0, page: 1, pageSize: 1, totalPages: 0, summary: { total: 0, breached: 0, warning: 0, healthy: 0 }, details: [] },
  },
  { path: "/api/ta/analytics/compliance", data: { totalRequirements: 0, statusBreakdown: {} } },
  { path: "/api/employees/redeployment-queue/summary", data: { total: 0, stages: { NEEDS_PLACEMENT: 0 } } },
];

const ROLE_PAGE: Record<Role, RolePage> = {
  admin: {
    url: "/admin/analytics",
    user: adminUser,
    dashboardPath: "/api/admin/analytics/dashboard",
    dashboard: { default: adminDashboard, empty: emptyAdmin, long: longAdmin },
    filtersPath: "/api/admin/analytics/filters",
    filters: { default: filterOptions, long: longFilterOptions },
  },
  recruiter: {
    url: "/ta/analytics",
    user: taUser,
    dashboardPath: "/api/ta/analytics/dashboard",
    dashboard: { default: taDashboard, empty: emptyTa, long: longTa },
    filtersPath: "/api/ta/analytics/filters",
    filters: { default: filterOptions, long: filterOptions },
    pending: {
      path: "/api/ta/analytics/pending-actions",
      data: { default: taDashboard.pendingActions, empty: [], long: longTa.pendingActions },
    },
    shell: TA_SHELL_MOCKS,
  },
};

interface CaptureLog {
  consoleErrors: string[];
  pageErrors: string[];
  httpErrors: string[];
  requestFailed: string[];
  unmockedApi: string[];
  blockedExternal: string[];
  dashboardHits: number;
}

const emptyLog = (): CaptureLog => ({
  consoleErrors: [],
  pageErrors: [],
  httpErrors: [],
  requestFailed: [],
  unmockedApi: [],
  blockedExternal: [],
  dashboardHits: 0,
});

function wire(page: Page, log: CaptureLog) {
  page.on("console", (msg) => {
    if (msg.type() === "error") log.consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on("pageerror", (error) => log.pageErrors.push(error.message.slice(0, 300)));
  page.on("response", (res) => {
    if (res.status() >= 400) log.httpErrors.push(`${res.status()} ${new URL(res.url()).pathname}`);
  });
  page.on("requestfailed", (req) => {
    log.requestFailed.push(`${req.method()} ${new URL(req.url()).pathname} ${req.failure()?.errorText ?? ""}`.trim());
  });
}

async function installRoutes(page: Page, role: Role, state: StateName, log: CaptureLog) {
  const cfg = ROLE_PAGE[role];
  const heldRoutes: Route[] = [];

  // Lowest precedence: an /api/ request with no mock is answered 404 and recorded. It is never forwarded.
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      log.unmockedApi.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Not mocked in analytics baseline capture", data: null }),
      });
    }
  );

  // Any other host (hosted backend, Supabase, Turnstile, fonts) is aborted. The preview origin is served normally.
  await page.route(
    (url) => !url.pathname.startsWith("/api/") && url.host !== PREVIEW_HOST,
    (route) => {
      const { origin, pathname } = new URL(route.request().url());
      log.blockedExternal.push(`${origin}${pathname}`);
      return route.abort("blockedbyclient");
    }
  );

  // The same session as the e2e specs (localStorage token and role) and the shell endpoints every page calls.
  await mockShell(page, cfg.user);

  // mockShell closes the notification stream at once. fetch-event-source then reconnects, and every reconnect
  // invalidates the role's queries (useRealtimeNotifications onReconnect). That refetch flips the report between
  // skeleton and error. Holding the stream open keeps the page on one state, as a quiet production session would be.
  await page.route(
    (url) => url.pathname === "/api/notifications/stream",
    (route) => {
      heldRoutes.push(route);
    }
  );

  const pick = <T,>(map: Record<string, T>, name: StateName): T => map[name] ?? map.default;

  await page.route(
    (url) => url.pathname === cfg.filtersPath,
    (route) => route.fulfill(json(pick(cfg.filters as Record<string, unknown>, state)))
  );

  if (cfg.pending) {
    const pending = cfg.pending;
    await page.route(
      (url) => url.pathname === pending.path,
      (route) => route.fulfill(json(pick(pending.data as Record<string, unknown>, state)))
    );
  }

  for (const shell of cfg.shell ?? []) {
    await page.route(
      (url) => url.pathname === shell.path,
      (route) => route.fulfill(json(shell.data))
    );
  }

  // The analytics endpoint under test. Loading holds the request open; error answers 500.
  await page.route(
    (url) => url.pathname === cfg.dashboardPath,
    (route) => {
      log.dashboardHits += 1;
      if (state === "loading") {
        heldRoutes.push(route);
        return undefined;
      }
      if (state === "error") {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ success: false, message: "Server error", data: null }),
        });
      }
      const base = pick(cfg.dashboard as Record<string, unknown>, state) as Record<string, unknown>;
      return route.fulfill(json({ ...(state === "empty" ? REDESIGN_EMPTY : REDESIGN_FIELDS), trend: (adminDashboard as Record<string, unknown>).trend, ...base }));
    }
  );
}

/** Waits until the state is on screen and reports what it waited for. */
async function settle(page: Page, state: StateName): Promise<{ settled: string; alerts: string[] }> {
  if (state === "loading") {
    await page.waitForTimeout(1500);
    return { settled: "request held open, screenshot after 1.5 s", alerts: [] };
  }
  if (state === "error") {
    // The page shows its own alert once react-query has finished retrying the 500 (several seconds).
    // Until then it shows the loading skeleton, so wait for the alert itself, not for the skeleton to go away.
    const alert = page.getByRole("alert").filter({ hasText: /Couldn.t load|Unable to load/ }).first();
    const shown = await alert.waitFor({ state: "visible", timeout: 60_000 }).then(
      () => true,
      () => false
    );
    await page.waitForTimeout(800);
    const alerts = (await page.getByRole("alert").allTextContents()).map((t) => t.replace(/\s+/g, " ").trim().slice(0, 120));
    return { settled: shown ? "error alert visible" : "error alert NOT visible after 60 s", alerts };
  }
  await page.getByRole("heading", { name: "Reports", level: 1 }).waitFor({ state: "visible", timeout: 30_000 });
  // The first section of both reports is "Needs action" (AttentionStrip, rendered in every loaded state, empty included).
  await page.getByRole("heading", { name: "Needs action", level: 2 }).waitFor({ state: "attached", timeout: 30_000 });
  await page.waitForTimeout(800);
  return { settled: "Reports and Needs action headings present", alerts: [] };
}

// ---------------------------------------------------------------------------
// In-page measurements (serialized into the browser: keep self-contained)
// ---------------------------------------------------------------------------

function describeLayout() {
  const cw = document.documentElement.clientWidth;
  const sw = document.documentElement.scrollWidth;
  const clipped = (el: Element) => {
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") return true;
    }
    return false;
  };
  const offenders: Array<{ tag: string; id: string | null; cls: string | null; text: string; right: number }> = [];
  let uncontained = 0;
  let contained = 0;
  for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.right <= cw + 1) continue;
    if (clipped(el)) {
      contained += 1;
      continue;
    }
    uncontained += 1;
    if (offenders.length < 8) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        cls: (el.getAttribute("class") ?? "").slice(0, 80) || null,
        text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 50),
        right: Math.round(r.right),
      });
    }
  }
  // Scroll containers whose content is wider than their box (for example a tab bar that scrolls sideways).
  const scrollers: Array<{ tag: string; id: string | null; cls: string | null; clientWidth: number; scrollWidth: number }> = [];
  for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
    const ox = getComputedStyle(el).overflowX;
    if (ox !== "auto" && ox !== "scroll") continue;
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    if (scrollers.length < 8) {
      scrollers.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        cls: (el.getAttribute("class") ?? "").slice(0, 80) || null,
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
      });
    }
  }
  return {
    clientWidth: cw,
    scrollWidth: sw,
    horizontalOverflow: sw > cw,
    scrollHeight: document.documentElement.scrollHeight,
    elementsPastViewportUnclipped: uncontained,
    elementsPastViewportInScrollers: contained,
    offenders,
    scrollers,
  };
}

function describeFocused() {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body || el === document.documentElement) {
    return { tag: "body", role: null, name: "", href: null, ringVisible: false, focusVisible: false, ring: "", note: "focus on body" };
  }
  const cs = getComputedStyle(el);
  const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
  const shadow = cs.boxShadow !== "none" && cs.boxShadow !== "";
  const byIds = (el.getAttribute("aria-labelledby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");
  let name = el.getAttribute("aria-label") || byIds;
  if (!name && el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    name = label?.textContent ?? "";
  }
  if (!name) name = (el as HTMLInputElement).placeholder || el.getAttribute("title") || el.textContent || "";
  if (!name) {
    const img = el.querySelector<HTMLImageElement>("img[alt]");
    name = img?.alt ?? "";
  }
  name = name.replace(/\s+/g, " ").trim().slice(0, 90);
  return {
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute("role"),
    name,
    href: el.getAttribute("href"),
    ringVisible: outline || shadow,
    ring: `outline=${cs.outlineStyle}/${cs.outlineWidth}; box-shadow=${shadow ? "set" : "none"}`,
    focusVisible: el.matches(":focus-visible"),
  };
}

async function measureFocus(page: Page) {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  const order: Array<Record<string, unknown>> = [];
  for (let step = 1; step <= FOCUS_STEPS; step += 1) {
    await page.keyboard.press("Tab");
    order.push({ step, ...(await page.evaluate(describeFocused)) });
  }
  return order;
}

/** Every heading in document order: level, text, and whether it is visually hidden (sr-only) or inside aria-hidden. */
function describeHeadings() {
  return Array.from(document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")).map((el) => ({
    level: Number(el.tagName.slice(1)),
    text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
    srOnly: el.classList.contains("sr-only"),
    inAriaHidden: el.closest('[aria-hidden="true"]') !== null,
  }));
}

async function runAxe(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  return {
    violations: result.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? null,
      help: v.help,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 6).map((n) => n.target.join(" ")),
      firstFailure: v.nodes[0]?.failureSummary?.replace(/\s+/g, " ").slice(0, 240) ?? null,
    })),
    passes: result.passes.length,
    incomplete: result.incomplete.length,
  };
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

const RESULTS: Record<string, Record<string, unknown>> = {};

/** One fresh page at one width, routed like captureState. The caller closes the context. */
async function openAt(browser: Browser, role: Role, state: StateName, width: number) {
  const vp = ALL_WIDTHS.find((w) => w.width === width) ?? ALL_WIDTHS[2];
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "Asia/Manila",
    colorScheme: "light",
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const log = emptyLog();
  wire(page, log);
  await installRoutes(page, role, state, log);
  await page.goto(ROLE_PAGE[role].url + (process.env.ANALYTICS_QUERY ?? ""), { waitUntil: "domcontentloaded" });
  return { context, page, log };
}

async function captureState(browser: Browser, role: Role, state: StateName) {
  const byWidth: Record<string, unknown> = {};
  let focus: unknown = null;
  let axe: unknown = null;

  for (const vp of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      locale: "en-US",
      timezoneId: "Asia/Manila",
      colorScheme: "light",
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    const log = emptyLog();
    wire(page, log);
    await installRoutes(page, role, state, log);
    await page.goto(ROLE_PAGE[role].url + (process.env.ANALYTICS_QUERY ?? ""), { waitUntil: "domcontentloaded" });
    const { settled, alerts } = await settle(page, state);

    const file = path.join(SHOT_DIR, `${role}-${state}-${vp.width}.png`);
    await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
    const layout = await page.evaluate(describeLayout);
    const headings = await page.evaluate(describeHeadings);

    if (vp.width === FOCUS_WIDTH) {
      focus = await measureFocus(page);
    }
    let widthAxe: unknown = null;
    if (vp.width === FOCUS_WIDTH || AXE_ALL_WIDTHS) {
      widthAxe = await runAxe(page);
    }
    if (vp.width === FOCUS_WIDTH) axe = widthAxe;

    byWidth[String(vp.width)] = {
      screenshot: path.relative(OUT_DIR, file).split(path.sep).join("/"),
      settled,
      alertsAfterSettle: alerts,
      layout,
      headings,
      axe: widthAxe,
      consoleErrors: log.consoleErrors,
      pageErrors: log.pageErrors,
      httpErrors: log.httpErrors,
      requestFailed: log.requestFailed,
      unmockedApi: log.unmockedApi,
      blockedExternal: log.blockedExternal,
      dashboardRequests: log.dashboardHits,
    };
    await context.close();
  }

  return { byWidth, focusOrderAt1280: focus, axeAt1280: axe };
}

test.describe.configure({ mode: "serial" });

test.describe("analytics baseline capture", () => {
  test.afterAll(() => {
    writeFileSync(
      path.join(OUT_DIR, "measurements.json"),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          dist: process.env.PERF_DIST ?? null,
          widths: WIDTHS.map((w) => w.width),
          focusWidth: FOCUS_WIDTH,
          focusSteps: FOCUS_STEPS,
          notes: [
            "ringVisible is a computed-style check (outline or any box-shadow) on the focused element, not a pixel check. Cards with a permanent shadow can read as ringVisible.",
            "Accessible names are approximated in-page (aria-label, aria-labelledby, label[for], placeholder, title, text). They are not the browser accessibility tree.",
            "Unmocked /api/ calls return 404 and are listed in unmockedApi. Aborted external requests are listed in blockedExternal.",
            "Error-state HTTP 500 responses and their 'Failed to load resource' console lines are expected.",
          ],
          results: RESULTS,
        },
        null,
        2
      ) + "\n"
    );
  });

  for (const role of ROLES) {
    for (const state of STATES) {
      test(`${role} ${state}`, async ({ browser }) => {
        RESULTS[`${role}.${state}`] = { role, state, url: ROLE_PAGE[role].url, ...(await captureState(browser, role, state)) };
      });
    }
  }

  // Design-review shots at 1280, default state. Only with ANALYTICS_EXTRAS=1, so the baseline run is unchanged.
  if (process.env.ANALYTICS_EXTRAS === "1") {
    test("design extras", async ({ browser }) => {
      const shot = (name: string) => path.join(SHOT_DIR, name);

      // Admin: "How these are counted" opened.
      {
        const { context, page, log } = await openAt(browser, "admin", "default", FOCUS_WIDTH);
        await settle(page, "default");
        await page.getByText("How these are counted", { exact: true }).click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: shot("admin-disclosure-1280.png"), fullPage: true, animations: "disabled" });
        RESULTS["extras.admin-disclosure-1280"] = {
          screenshot: "screenshots/admin-disclosure-1280.png",
          details: await page.evaluate(() =>
            Array.from(document.querySelectorAll("details")).map((d) => ({ open: d.open, summary: d.querySelector("summary")?.textContent?.trim() ?? null }))
          ),
          consoleErrors: log.consoleErrors,
          pageErrors: log.pageErrors,
          unmockedApi: log.unmockedApi,
        };
        await context.close();
      }

      // Admin: Export menu opened.
      {
        const { context, page, log } = await openAt(browser, "admin", "default", FOCUS_WIDTH);
        await settle(page, "default");
        await page.getByRole("button", { name: "Export", exact: true }).click();
        await page.getByRole("button", { name: "Candidates by stage (PDF)" }).waitFor({ state: "visible", timeout: 10_000 });
        await page.screenshot({ path: shot("admin-export-1280.png"), fullPage: true, animations: "disabled" });
        RESULTS["extras.admin-export-1280"] = {
          screenshot: "screenshots/admin-export-1280.png",
          menuItems: await page.getByRole("button", { name: /\((PDF|Excel)\)$/ }).allTextContents(),
          consoleErrors: log.consoleErrors,
          pageErrors: log.pageErrors,
          unmockedApi: log.unmockedApi,
        };
        await context.close();
      }

      // Recruiter: keyboard focus after 8 Tab presses. Viewport shot, so the focused control is in frame.
      {
        const { context, page, log } = await openAt(browser, "recruiter", "default", FOCUS_WIDTH);
        await settle(page, "default");
        await page.evaluate(() => {
          (document.activeElement as HTMLElement | null)?.blur();
          window.scrollTo(0, 0);
        });
        const order: Array<Record<string, unknown>> = [];
        for (let step = 1; step <= 8; step += 1) {
          await page.keyboard.press("Tab");
          order.push({ step, ...(await page.evaluate(describeFocused)) });
        }
        await page.screenshot({ path: shot("recruiter-focus-1280.png"), animations: "disabled" });
        RESULTS["extras.recruiter-focus-1280"] = {
          screenshot: "screenshots/recruiter-focus-1280.png",
          tabsPressed: 8,
          order,
          consoleErrors: log.consoleErrors,
          pageErrors: log.pageErrors,
          unmockedApi: log.unmockedApi,
        };
        await context.close();
      }
    });
  }
});
