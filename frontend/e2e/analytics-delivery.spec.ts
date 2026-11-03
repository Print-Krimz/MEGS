import { test, expect, type Page } from "@playwright/test";
import { json, mockShell } from "./helpers/mock-shell";

// Reports pages: the team leader (/admin/analytics) and the recruiter (/ta/analytics).
// Every /api/ call is answered by page.route. Nothing reaches a backend or a database.
// Fixtures follow the backend shapes after the overhaul: a sample size next to each rate and median (null under 5),
// derived KPI fields, backend-worded reason labels, and no recruiter fields on the recruiter's own dashboard.

type Role = "admin" | "recruiter";

const PATHS = {
  admin: {
    page: "/admin/analytics",
    dashboard: "/api/admin/analytics/dashboard",
    reports: "/api/admin/reports/",
    filters: "/api/admin/analytics/filters",
  },
  recruiter: {
    page: "/ta/analytics",
    dashboard: "/api/ta/analytics/dashboard",
    reports: "/api/ta/reports/",
    filters: "/api/ta/analytics/filters",
  },
} as const;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const adminUser = {
  id: "admin-1",
  email: "admin@megs.ph",
  role: "ADMINISTRATOR",
  isActive: true,
  applicantProfile: { firstName: "Team", lastName: "Leader" },
};
const taUser = {
  id: "ta-1",
  email: "alice@megs.ph",
  role: "TALENT_ACQUISITION",
  isActive: true,
  applicantProfile: { firstName: "Alice", lastName: "Recruiter" },
};

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
  recruiters: Array.from({ length: 35 }, (_, i) => ({ id: `ta-${i}`, name: recruiterName(i), email: `recruiter${i + 1}@megs.ph` })),
};

const backouts = {
  withdrawals: 1,
  backouts: 3,
  noShows: 1,
  byParty: { APPLICANT: 2, CLIENT: 1, AGENCY: 1 },
  byStage: [
    { stage: "CLIENT_ENDORSEMENT", label: "Client review", APPLICANT: 1, CLIENT: 0, AGENCY: 0, total: 1 },
    { stage: "COMPLIANCE", label: "Requirements", APPLICANT: 1, CLIENT: 1, AGENCY: 1, total: 3 },
  ],
  topReasons: [
    { reason: "ACCEPTED_OTHER_OFFER", label: "Accepted another offer", count: 2 },
    { reason: "CLIENT_CANCELLED_REQUEST", label: "Client cancelled the request", count: 1 },
  ],
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
      reasonLabel: "Accepted another offer",
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
  typicalWaitSample: 0,
  slaDays: 7,
  ...over,
});

const stageTable = [
  stage("APPLIED", "Submitted", { inStageNow: 30, overdue: 2, entered: 24, backedOut: 1, avgDaysInStage: 3.2, medianDaysInStage: 3, typicalWaitSample: 24 }),
  stage("INITIAL_SCREENING", "Initial screening", { inStageNow: 15, entered: 12, avgDaysInStage: 2.1, medianDaysInStage: 2, typicalWaitSample: 12 }),
  stage("CLIENT_ENDORSEMENT", "Client review", { inStageNow: 5, overdue: 3, entered: 5, avgDaysInStage: 6.4, medianDaysInStage: 6, typicalWaitSample: 5, slaDays: 5 }),
  stage("FINAL_INTERVIEW", "Final interview", { slaDays: 5 }),
  stage("COMPLIANCE", "Requirements", { inStageNow: 54, overdue: 20, overdueEstimated: 6, entered: 8, backedOut: 3, avgDaysInStage: 9.5, medianDaysInStage: 8, typicalWaitSample: 8, slaDays: 14 }),
  stage("CONTRACT_SIGNING", "Contract signing", { inStageNow: 2, entered: 2, typicalWaitSample: 2, slaDays: 7 }),
  stage("DEPLOYED", "Deployed", { inStageNow: 1, entered: 1, typicalWaitSample: 1, slaDays: 7 }),
];
// Under five samples the backend nulls the median (and the average): Client review has 4 entries here.
const stageTableSmall = stageTable.map((s) =>
  s.stage === "CLIENT_ENDORSEMENT" ? { ...s, typicalWaitSample: 4, medianDaysInStage: null, avgDaysInStage: null } : s
);
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
  lateRequests: 2,
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
  backoutRate: null,
  backoutRateBase: 0,
  lateRequests: 0,
  overdueTotal: 0,
  activeApplicants: 0,
  overdueCandidates: 0,
  overdueEstimated: 0,
  closedOpenings: 0,
  staleFilledRequisitions: 0,
  criticalCandidates: 0,
};
// The recruiter's own numbers: one late request is theirs.
const taKpis = { ...kpis, lateRequests: 1 };
// A base of four: the rate is null and the tile says so. The median still has five samples.
const smallKpis = { ...kpis, backoutRate: null, backoutRateBase: 4 };

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
  backoutRate: null,
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
const zeroTrend = { granularity: "day", points: trend.points.map((p) => ({ ...p, starts: 0, newStarts: 0, redeployStarts: 0, backouts: 0, withdrawals: 0 })) };

const previousPeriod = {
  startDate: "2026-09-30",
  endDate: "2026-10-06",
  placementsStarted: 4,
  newStarts: 3,
  redeployStarts: 1,
  medianDaysToFill: 22,
  daysToFillSample: 6,
  backoutRate: 40,
  backoutRateBase: 10,
};
const clientReview = {
  avgDays: 6.4,
  sample: 11,
  clients: [
    { clientId: 1, clientName: "Acme Industrial Corp", inReview: 7, avgDays: 7.5, limitDays: 5, overdue: 4 },
    { clientId: 2, clientName: "Beta Fabrication", inReview: 4, avgDays: null, limitDays: 5, overdue: 0 },
  ],
};
const dueSoon = [
  { applicationId: 821, candidateName: "Nena Flores", jobTitle: "Welder", clientName: "Beta Fabrication", mrfId: 3, recruiterId: "ta-1", recruiterName: "Alice Recruiter", stage: "FINAL_INTERVIEW", stageLabel: "Final interview", daysInStage: 4, slaDays: 5, daysOver: 0, urgency: "overdue", estimated: false, lastActivityAt: null, lastNote: null, daysLeft: 1 },
];

const taDashboard = {
  dateRange,
  previousPeriod,
  clientReview,
  dueSoon,
  dueSoonTotal: 1,
  trend,
  kpis: taKpis,
  requests: requests.filter((r) => r.ownerId === "ta-1"),
  stageTable,
  dropOff: [
    { stage: "APPLIED", label: "Submitted", reached: 24, inStage: 6, movedForward: 12, backedOut: 1, rejected: 5 },
    { stage: "INITIAL_SCREENING", label: "Initial screening", reached: 18, inStage: 8, movedForward: 8, backedOut: 0, rejected: 2 },
    { stage: "COMPLIANCE", label: "Requirements", reached: 8, inStage: 4, movedForward: 1, backedOut: 3, rejected: 0 },
  ],
  backouts,
  clientDecisions: { accepted: 15, declined: 2 },
  stuck: [
    { applicationId: 811, candidateName: "Mario Reyes", jobTitle: "Industrial Electrician", clientName: "Acme Industrial Corp", mrfId: 10, recruiterId: "ta-1", recruiterName: "You", stage: "COMPLIANCE", stageLabel: "Requirements", daysInStage: 20, slaDays: 14, daysOver: 6, urgency: "overdue", estimated: false, lastActivityAt: "2026-10-28T08:00:00.000Z", lastNote: "Waiting for NBI clearance" },
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
  ],
  filterOptions,
};

const adminDashboard = {
  dateRange,
  previousPeriod,
  clientReview,
  dueSoon,
  dueSoonTotal: 1,
  kpis,
  team: [
    teamRow({ recruiterId: "ta-1", name: "Alice Recruiter", active: 40, overdue: 12, overdueEstimated: 3, openRequisitions: 2, requestedSeats: 35, filledSeats: 24, fillRate: 68.6, sentToClient: 9, newStarts: 2, redeployStarts: 2, placed: 4, backouts: 2, backoutRate: 33.3, backoutRateBase: 6, medianDaysToFill: 20, daysToFillSample: 6 }),
    teamRow({ recruiterId: "ta-2", name: "Bob Recruiter", active: 22, overdue: 1, overdueEstimated: 0, openRequisitions: 1, requestedSeats: 5, filledSeats: 1, fillRate: 20, sentToClient: 4, newStarts: 2, redeployStarts: 0, placed: 2, backouts: 1, backoutRate: 33.3, backoutRateBase: 3, medianDaysToFill: 15, daysToFillSample: 2 }),
  ],
  unassigned: { applicants: 45, overdue: 12, overdueEstimated: 3, requests: 0, requestedSeats: 0, oldestWaitDays: 41 },
  requests,
  trend,
  backouts,
  clientDecisions: { accepted: 15, declined: 2 },
  stageTable,
  stuck: [
    { applicationId: 801, candidateName: "Ramon Gomez", jobTitle: "Forklift Operator", clientName: "Gamma Logistics", mrfId: 4, recruiterId: "ta-1", recruiterName: "Alice Recruiter", stage: "COMPLIANCE", stageLabel: "Requirements", daysInStage: 31, slaDays: 14, daysOver: 17, urgency: "critical", estimated: false, lastActivityAt: "2026-10-20T08:00:00.000Z", lastNote: "Client asked for a new medical" },
    { applicationId: 802, candidateName: "Lito Santos", jobTitle: "Welder", clientName: "Beta Fabrication", mrfId: 3, recruiterId: "ta-2", recruiterName: "Bob Recruiter", stage: "FINAL_INTERVIEW", stageLabel: "Final interview", daysInStage: 9, slaDays: 5, daysOver: 4, urgency: "overdue", estimated: true, lastActivityAt: null, lastNote: null },
  ],
  stuckTotal: 2,
  filterOptions,
};

const emptyClientReview = { avgDays: null, sample: 0, clients: [] };
const emptyAdmin = {
  ...adminDashboard,
  clientReview: emptyClientReview,
  dueSoon: [],
  dueSoonTotal: 0,
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
const emptyTa = {
  ...taDashboard,
  clientReview: emptyClientReview,
  dueSoon: [],
  dueSoonTotal: 0,
  trend: zeroTrend,
  kpis: { ...zeroKpis, backoutRate: null },
  requests: [],
  stageTable: zeroStageTable,
  backouts: emptyBackouts,
  clientDecisions: { accepted: 0, declined: 0 },
  stuck: [],
  stuckTotal: 0,
  pendingActionsTotal: 0,
  pendingActions: [],
};

// Under five in the base for the rate. Bob's own rate is null for the same reason.
const smallAdmin = {
  ...adminDashboard,
  kpis: smallKpis,
  team: [
    adminDashboard.team[0],
    teamRow({ ...adminDashboard.team[1], backoutRate: null, backoutRateBase: 4 }),
  ],
  stageTable: stageTableSmall,
};
const smallTa = { ...taDashboard, kpis: { ...taKpis, backoutRate: null, backoutRateBase: 4 }, stageTable: stageTableSmall };

// Long data: 35 recruiters, 60 requests, 250 waiting candidates.
const longAdmin = {
  ...adminDashboard,
  kpis: { ...kpis, lateRequests: 12, criticalCandidates: 3, overdueTotal: 280 },
  team: Array.from({ length: 35 }, (_, i) =>
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
      backoutRate: i % 3 === 0 ? null : 33.3,
      backoutRateBase: 3 + (i % 6),
      medianDaysToFill: 10 + (i % 12),
      daysToFillSample: 1 + (i % 10),
    })
  ),
  requests: Array.from({ length: 60 }, (_, i) =>
    request({
      mrfId: i + 1,
      title: `Request ${i + 1}`,
      clientId: (i % 12) + 1,
      clientName: `Client ${(i % 12) + 1}`,
      ownerId: `ta-${i % 35}`,
      ownerName: recruiterName(i % 35),
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
  stuck: Array.from({ length: 250 }, (_, i) => ({
    applicationId: 900 + i,
    candidateName: `Candidate ${String(i + 1).padStart(3, "0")}`,
    jobTitle: "Industrial Electrician",
    clientName: `Client ${(i % 12) + 1}`,
    mrfId: (i % 12) + 1,
    recruiterId: `ta-${i % 35}`,
    recruiterName: recruiterName(i % 35),
    stage: "COMPLIANCE",
    stageLabel: "Requirements",
    daysInStage: 15 + (i % 20),
    slaDays: 14,
    daysOver: 1 + (i % 20),
    urgency: i < 3 ? "critical" : "overdue",
    estimated: i % 7 === 0,
  })),
  stuckTotal: 250,
  filterOptions: longFilterOptions,
};
const longTa = {
  ...taDashboard,
  kpis: { ...taKpis, lateRequests: 10, overdueTotal: 250 },
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
  stuck: Array.from({ length: 250 }, (_, i) => ({
    applicationId: 1000 + i,
    candidateName: `Candidate ${String(i + 1).padStart(3, "0")}`,
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
  stuckTotal: 250,
  pendingActionsTotal: 40,
  pendingActions: taDashboard.pendingActions,
};

// Nav-badge queries from the TA layout. Zero counts, the same in every state.
const TA_SHELL = [
  { path: "/api/ta/compliance/interviews", data: { items: [], total: 0, page: 1, pageSize: 1, totalPages: 0, summary: { total: 0, breached: 0, warning: 0, healthy: 0 }, details: [] } },
  { path: "/api/ta/analytics/compliance", data: { totalRequirements: 0, statusBreakdown: {} } },
  { path: "/api/employees/redeployment-queue/summary", data: { total: 0, stages: { NEEDS_PLACEMENT: 0 } } },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Harness {
  /** Every /api/ request the page made, in order. */
  api: URL[];
  /** /api/ calls that had no mock and were answered 404. */
  unmocked: string[];
  pageErrors: string[];
  consoleErrors: string[];
}

/** Mocks one role's reports page. Register before page.goto. */
async function setup(page: Page, role: Role, dashboard: unknown, opts: { fail?: boolean } = {}): Promise<Harness> {
  const h: Harness = { api: [], unmocked: [], pageErrors: [], consoleErrors: [] };
  const p = PATHS[role];
  page.on("pageerror", (e) => h.pageErrors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") h.consoleErrors.push(m.text());
  });
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.pathname.startsWith("/api/")) h.api.push(url);
  });

  // Registered first, so it has the lowest precedence: an /api/ call with no mock gets a 404 and is recorded.
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      h.unmocked.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
      return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ success: false, message: "Not mocked", data: null }) });
    }
  );
  await mockShell(page, role === "admin" ? adminUser : taUser);
  // Quick view loads the candidate record; a test that needs real data registers its own route later, which wins.
  await page.route(
    (url) => /^\/api\/(ta|admin)\/applications\/\d+$/.test(url.pathname),
    (route) =>
      route.fulfill(
        json({ id: 1, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-02T00:00:00.000Z", user: { email: "candidate@example.com", applicantProfile: { mobileNumber: "09170000000" } } })
      )
  );
  await page.route(
    (url) => url.pathname === p.dashboard,
    (route) =>
      opts.fail
        ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ success: false, message: "Server error" }) })
        : route.fulfill(json(dashboard))
  );
  await page.route(
    (url) => url.pathname === p.filters,
    (route) => route.fulfill(json((dashboard as { filterOptions: unknown }).filterOptions))
  );
  await page.route(
    (url) => url.pathname.startsWith(p.reports),
    (route) => route.fulfill({ status: 200, contentType: "application/pdf", body: "%PDF-1.4\n" })
  );
  if (role === "recruiter") {
    await page.route(
      (url) => url.pathname === "/api/ta/analytics/pending-actions",
      (route) => route.fulfill(json((dashboard as { pendingActions?: unknown[] }).pendingActions ?? []))
    );
    for (const shell of TA_SHELL) {
      await page.route(
        (url) => url.pathname === shell.path,
        (route) => route.fulfill(json(shell.data))
      );
    }
  }
  return h;
}

const dashboardCalls = (h: Harness, role: Role) => h.api.filter((u) => u.pathname === PATHS[role].dashboard);
const lastQuery = (h: Harness, role: Role, key: string) => dashboardCalls(h, role).at(-1)?.searchParams.get(key) ?? null;
/** Query pairs as sorted strings, optionally without some keys, so two URLs can be compared exactly. */
const pairs = (u: URL, drop: string[] = []) =>
  [...u.searchParams.entries()].filter(([k]) => !drop.includes(k)).map(([k, v]) => `${k}=${v}`).sort();

const expectReportsLoaded = async (page: Page) => {
  await expect(page.getByRole("heading", { name: "Reports", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Needs action" })).toBeVisible();
};

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

/** Opens a tab of the operations workspace and returns its visible panel. */
const openTab = async (page: Page, name: RegExp) => {
  await page.getByRole("tab", { name }).click();
  await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
  return page.getByRole("tabpanel");
};

/** Headings and the tab list in document order, skipping anything hidden. */
const outline = (page: Page) =>
  page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("main h1, main h2, main h3, main [role='tablist']"));
    return nodes
      .filter((el) => !el.closest("[hidden]") && getComputedStyle(el).display !== "none")
      .map((el) => (el.getAttribute("role") === "tablist" ? "TABS" : (el.textContent ?? "").replace(/\s+/g, " ").trim()));
  });

const expectInOrder = (actual: string[], expected: string[]) => {
  const positions = expected.map((name) => actual.indexOf(name));
  expect(positions, `${expected.join(" > ")} within [${actual.join(" | ")}]`).not.toContain(-1);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
};

type Stop = { text: string; tag: string; role: string | null; region: string | null; focusVisible: boolean; ring: boolean };

const focusedStop = (page: Page) =>
  page.evaluate((): Stop | null => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    return {
      text: (el.getAttribute("aria-label") ?? el.textContent ?? "").replace(/\s+/g, " ").trim(),
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role"),
      region: el.closest("section[aria-label]")?.getAttribute("aria-label") ?? null,
      focusVisible: el.matches(":focus-visible"),
      ring: cs.boxShadow !== "none" || (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0),
    };
  });

/** Presses Tab from the top of the page until the first tab of the workspace has focus. */
async function tabToWorkspace(page: Page): Promise<Stop[]> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  const trail: Stop[] = [];
  for (let i = 0; i < 90; i += 1) {
    await page.keyboard.press("Tab");
    const stop = await focusedStop(page);
    if (!stop) break;
    trail.push(stop);
    if (stop.role === "tab") break;
  }
  return trail;
}

// ---------------------------------------------------------------------------
// Team leader (/admin/analytics)
// ---------------------------------------------------------------------------

test.describe("Team leader reports (/admin/analytics)", () => {
  test("the headings read in order: Needs action, headline numbers, stages, results, client reviews, reasons, then the lists", async ({ page }) => {
    const h = await setup(page, "admin", adminDashboard);
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);

    const headings = await outline(page);
    expect(headings[0]).toBe("Reports");
    expectInOrder(headings, [
      "Reports",
      "Needs action",
      "Headline numbers",
      "Right now",
      "In these dates",
      "Candidates by stage",
      "Results over time",
      "Slowest client reviews",
      "Why candidates backed out",
      "TABS",
    ]);
    // The old backout detail panel is gone; the reasons ring replaces it.
    await expect(page.getByRole("heading", { name: "Why people backed out" })).toHaveCount(0);
    expect(h.unmocked).toEqual([]);
    expect(h.pageErrors).toEqual([]);
  });

  test("headline numbers show the value, the counts behind it, and the time base each belongs to", async ({ page }) => {
    await setup(page, "admin", adminDashboard);
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);

    const now = page.getByRole("region", { name: "Right now" });
    const period = page.getByRole("region", { name: "In these dates" });
    await expect(now.getByRole("link", { name: /^Seats filled/ })).toContainText("62.5%");
    await expect(now.getByRole("link", { name: /^Seats filled/ })).toContainText("25 of 40 filled · 15 open");
    await expect(now.getByText("2 overdue or at risk")).toBeVisible();
    await expect(now.getByRole("link", { name: /^Client review wait/ })).toContainText("6.4 days");
    await expect(now.getByRole("link", { name: /^Client review wait/ })).toContainText("1 client past their limit");
    await expect(period.getByText("18.5 days")).toBeVisible();
    await expect(period.getByText("Typical, from 5 starts")).toBeVisible();
    // 18.5 days now against 22 in the previous seven days.
    await expect(period.getByText("-3.5 days")).toBeVisible();
    await expect(period.getByText("vs previous 7 days")).toBeVisible();
  });

  test("how each number is counted sits behind one disclosure", async ({ page }) => {
    await setup(page, "admin", adminDashboard);
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);
    const definition = page.getByText("Seats with a worker who started, out of seats clients asked for.");
    await expect(definition).toBeHidden();
    await page.locator("summary", { hasText: "How these are counted" }).click();
    await expect(definition).toBeVisible();
    await expect(page.getByText(/^Typical days from request opened to worker start, compared with/)).toBeVisible();
  });

  test("a rate under five samples reads Too few to show (4 cases), and five samples show the number", async ({ page }) => {
    await setup(page, "admin", smallAdmin);
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);

    const period = page.getByRole("region", { name: "In these dates" });
    // The client with four candidates in review has no average to show. The number from a base of four is not a headline tile any more.
    await expect(page.locator("#client-review").getByRole("listitem").filter({ hasText: "Beta Fabrication" })).toContainText("Too few to show (4 cases)");
    // Days to fill has five starts behind it, so the number shows.
    await expect(period.getByText("18.5 days")).toBeVisible();

    const team = await openTab(page, /^Recruiters/);
    await expect(team.getByRole("row", { name: /Bob Recruiter/ })).toContainText("Too few to show (4 cases)");
    await expect(team.getByRole("row", { name: /Alice Recruiter/ })).toContainText("33.3%");

    const stages = page.locator("#stage-pipeline");
    await stages.getByText("View as table").click();
    await expect(stages.getByRole("row", { name: /Client review/ })).toContainText("Too few to show (4 cases)");
    await expect(stages.getByRole("row", { name: /Requirements/ })).toContainText("8 days");
  });

  test("the Needs action strip counts what needs action, and each chip opens the list it counts", async ({ page }) => {
    await setup(page, "admin", adminDashboard);
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);

    const strip = page.getByRole("region", { name: "Needs action" });
    await expect(strip.getByRole("link", { name: /critical wait$/ })).toBeVisible();
    await expect(strip.getByRole("link", { name: /overdue or at-risk requests$/ })).toBeVisible();
    await expect(strip.getByRole("link", { name: /requests filled with no start$/ })).toBeVisible();

    await strip.getByRole("link", { name: /critical wait$/ }).click();
    const waiting = await openTab(page, /^Overdue candidates/);
    await expect(waiting.getByRole("button", { name: /^Critical 1$/ })).toHaveAttribute("aria-pressed", "true");
    await expect(waiting.getByRole("listitem")).toHaveCount(1);
    await expect(page.locator("#operations")).toBeInViewport();

    await strip.getByRole("link", { name: /overdue or at-risk requests$/ }).click();
    const requests = await openTab(page, /^Client requests/);
    await expect(requests.getByRole("button", { name: /^Overdue or at risk 2$/ })).toHaveAttribute("aria-pressed", "true");
    await expect(requests.getByRole("listitem")).toHaveCount(2);

    await strip.getByRole("link", { name: /requests filled with no start$/ }).click();
    await expect(page.locator("#requests-note")).toContainText("28 marked filled with no start");
    await expect(requests.getByRole("button", { name: /^All 3$/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("the Seats filled tile opens every client request", async ({ page }) => {
    await setup(page, "admin", adminDashboard);
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);
    await page.getByRole("link", { name: /^Seats filled/ }).click();
    await expect(page.getByRole("tab", { name: /^Client requests/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel").getByRole("button", { name: /^All 3$/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("the stage table gives the exact counts; a stage with overdue candidates lists them in the workspace", async ({ page }) => {
    await setup(page, "admin", adminDashboard);
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);

    const stages = page.locator("#stage-pipeline");
    await expect(stages.getByRole("listitem")).toHaveCount(7);
    await stages.getByText("View as table").click();
    const requirements = stages.getByRole("row", { name: /Requirements/ });
    await expect(requirements).toContainText("20 + 6 estimated");
    await expect(requirements).toContainText("8 days");
    await expect(requirements).toContainText("14 days");

    await stages.getByRole("button", { name: /^Requirements, 54 · 26 overdue/ }).click();
    const waiting = await openTab(page, /^Overdue candidates/);
    await expect(waiting.getByRole("combobox", { name: /^Stage/ })).toHaveValue("COMPLIANCE");
    await expect(waiting.getByRole("link", { name: "Ramon Gomez" })).toBeVisible();
    await expect(waiting.getByRole("link", { name: "Lito Santos" })).toHaveCount(0);
  });

  test("the three lists share one workspace, keep their own filters, and arrow keys move between tabs", async ({ page }) => {
    await setup(page, "admin", adminDashboard);
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);

    await expect(page.getByRole("tab", { name: /^Overdue candidates\s+2$/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Client requests\s+3$/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Recruiters\s+2$/ })).toBeVisible();
    await expect(page.getByRole("tabpanel")).toHaveCount(1);

    const waiting = await openTab(page, /^Overdue candidates/);
    await waiting.getByRole("button", { name: /^Critical 1$/ }).click();
    await openTab(page, /^Client requests/);
    await openTab(page, /^Overdue candidates/);
    await expect(waiting.getByRole("button", { name: /^Critical 1$/ })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("tab", { name: /^Overdue candidates/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /^Client requests/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: /^Client requests/ })).toBeFocused();
  });

  test("client requests list the most urgent first, one row each, with the recruiter, seats, due date and a link", async ({ page }) => {
    await setup(page, "admin", adminDashboard);
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);

    const list = await openTab(page, /^Client requests/);
    await expect(list.getByRole("listitem").getByRole("link")).toHaveText(["5x Certified Welders", "10x Industrial Electricians", "25x Warehouse Staff"]);
    const welders = list.getByRole("listitem").filter({ hasText: "5x Certified Welders" });
    await expect(welders).toContainText("Beta Fabrication");
    await expect(welders).toContainText("Bob Recruiter");
    await expect(welders).toContainText("Overdue: 12 days late");
    await expect(welders).toContainText("1/5 seats");
    await expect(welders.getByRole("link", { name: "5x Certified Welders" })).toHaveAttribute("href", "/admin/mrfs/3");
    await expect(list.getByRole("listitem").filter({ hasText: "10x Industrial" })).toContainText("At risk");
    await expect(list.getByRole("listitem").filter({ hasText: "25x Warehouse" })).toContainText("On track");
    await expect(list.getByText("28 marked filled with no start. Left out of seat counts.")).toBeVisible();
  });

  test("the status filters classify requests the way the server does", async ({ page }) => {
    await setup(page, "admin", adminDashboard);
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);

    const list = await openTab(page, /^Client requests/);
    for (const [name, count] of [["Overdue", 1], ["At risk", 1], ["On track", 1], ["Filled", 0]] as const) {
      await list.getByRole("button", { name: new RegExp(`^${name} ${count}$`) }).click();
      await expect(list.getByRole("listitem")).toHaveCount(count);
    }
  });

  test("a request assigned to an Administrator account shows No recruiter, never the account name", async ({ page }) => {
    const adminOwned = request({ mrfId: 9, title: "Admin-held request", ownerId: null, ownerName: "Team Leader", health: "ON_TRACK", targetFillDate: null, daysRemaining: null });
    await setup(page, "admin", { ...adminDashboard, requests: [...requests, adminOwned] });
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);

    const list = await openTab(page, /^Client requests\s+4$/);
    const row = list.getByRole("listitem").filter({ hasText: "Admin-held request" });
    await expect(row).toContainText("No recruiter assigned");
    await expect(row).not.toContainText("Team Leader");
  });

  test("the recruiter table adds up to the headline starts, and shows the seats each recruiter filled", async ({ page }) => {
    await setup(page, "admin", adminDashboard);
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);

    const team = await openTab(page, /^Recruiters/);
    const alice = team.getByRole("row", { name: /Alice Recruiter/ });
    const bob = team.getByRole("row", { name: /Bob Recruiter/ });
    // Columns after the name: Active, Overdue, Open requests, Seats filled, Starts, Backout rate, Days to fill
    const starts = Number(await alice.locator("td").nth(4).innerText()) + Number(await bob.locator("td").nth(4).innerText());
    expect(starts).toBe(adminDashboard.kpis.placementsStarted);
    await expect(alice).toContainText("24 of 35");
  });

  test("selecting a recruiter filters the whole page, and the choice survives a reload", async ({ page }) => {
    const h = await setup(page, "admin", adminDashboard);
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);

    const team = await openTab(page, /^Recruiters/);
    // Wait for the tab to be written to the URL before the next navigation, so the two updates do not race.
    await expect(page).toHaveURL(/tab=recruiters/);
    await team.getByRole("button", { name: /^Alice Recruiter\. Filter the page/ }).click();
    await expect.poll(() => lastQuery(h, "admin", "recruiterId")).toBe("ta-1");
    await expect(page.getByTestId("active-filter-chip-recruiterId")).toContainText("Alice Recruiter");

    await page.reload();
    await expectReportsLoaded(page);
    await expect(page.getByRole("tab", { name: /^Recruiters/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel").getByRole("button", { name: /^Alice Recruiter\. Show all recruiters/ })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => lastQuery(h, "admin", "recruiterId")).toBe("ta-1");
  });

  test("the waiting list shows urgency, the recruiter, days over and the limit, and its filters work", async ({ page }) => {
    await setup(page, "admin", adminDashboard);
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);

    const waiting = await openTab(page, /^Overdue candidates/);
    const ramon = waiting.getByRole("listitem").filter({ hasText: "Ramon Gomez" });
    await expect(ramon).toContainText("Critical");
    await expect(ramon).toContainText("17 days over");
    await expect(ramon).toContainText("Requirements");
    await expect(ramon).toContainText("31 of 14 days");
    await expect(ramon).toContainText("Alice Recruiter");
    const lito = waiting.getByRole("listitem").filter({ hasText: "Lito Santos" });
    await expect(lito).toContainText("estimated from application date");
    await expect(waiting.getByText("2 more are on closed job openings.")).toBeVisible();

    await waiting.getByRole("button", { name: /^Critical 1$/ }).click();
    await expect(waiting.getByRole("listitem")).toHaveCount(1);
    await waiting.getByRole("button", { name: /^All 2$/ }).click();
    await waiting.getByRole("combobox", { name: /^Stage/ }).selectOption("FINAL_INTERVIEW");
    await expect(waiting.getByRole("link", { name: "Ramon Gomez" })).toHaveCount(0);
    await expect(waiting.getByRole("link", { name: "Lito Santos" })).toBeVisible();
  });

  test("a candidate in the waiting list opens the application page for the admin", async ({ page }) => {
    await setup(page, "admin", adminDashboard);
    await page.route(
      (url) => url.pathname === "/api/admin/applications/801",
      (route) =>
        route.fulfill(
          json({
            id: 801,
            status: "COMPLIANCE",
            isArchived: false,
            createdAt: "2026-09-01T00:00:00.000Z",
            updatedAt: "2026-10-01T00:00:00.000Z",
            user: { id: "u-1", email: "ramon@example.com", applicantProfile: { firstName: "Ramon", lastName: "Gomez", mobileNumber: "09171234567" } },
            jobPosting: { id: 7, title: "Forklift Operator", location: "Laguna", mrf: { id: 4, title: "25x Warehouse Staff", client: { id: 3, name: "Gamma Logistics" } } },
            interviews: [{ type: "FINAL_INTERVIEW", scheduledAt: "2026-09-20T00:00:00.000Z", result: "PASS" }],
            clientEndorsements: [{ client: { name: "Gamma Logistics" }, outcome: "ENDORSED", createdAt: "2026-09-10T00:00:00.000Z" }],
            complianceRequirements: [{ documentLabel: "NBI Clearance", reviewStatus: "PENDING", deadline: "2026-09-25T00:00:00.000Z" }],
            deployments: [],
            backout: null,
          })
        )
    );
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);
    const waiting = await openTab(page, /^Overdue candidates/);
    await waiting.getByRole("link", { name: "Ramon Gomez" }).click();
    await expect(page).toHaveURL(/\/admin\/applications\/801$/);
    await expect(page.getByRole("heading", { name: "Ramon Gomez" })).toBeVisible();
    await expect(page.getByText("NBI Clearance")).toBeVisible();
    await expect(page).not.toHaveURL(/forbidden/);
  });

  test("the reasons ring lists why people backed out, by label", async ({ page }) => {
    await setup(page, "admin", adminDashboard);
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);

    const legend = page.locator("#backout-reasons").getByRole("list", { name: /legend/ });
    await expect(legend).toContainText("Accepted another offer");
    await expect(legend).toContainText("Client cancelled the request");
  });

  test("the results-over-time chart names both lines and has a table under it", async ({ page }) => {
    await setup(page, "admin", adminDashboard);
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);
    const trendPanel = page.locator("#trend");
    await expect(trendPanel.getByRole("img", { name: "Results over time" })).toBeVisible();
    await expect(trendPanel.getByRole("list", { name: "Legend" })).toContainText("Starts");
    await expect(trendPanel.getByRole("list", { name: "Legend" })).toContainText("Backed out");
    await trendPanel.getByText("View as table").click();
    // Columns: Period, Starts, Backed out. Oct 13 has 4 new and 2 redeployed starts, and 3 backouts.
    const lastDay = trendPanel.getByRole("row", { name: /Oct 13/ });
    await expect(lastDay.getByRole("cell").nth(0)).toHaveText("6");
    await expect(lastDay.getByRole("cell").nth(1)).toHaveText("3");
  });

  test("the retired panels are gone", async ({ page }) => {
    await setup(page, "admin", adminDashboard);
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);
    for (const name of ["Workload compared", "Seats by client", "Work no recruiter owns", "Reviews that need attention", "Applications by job opening", "Last 12 weeks"]) {
      await expect(page.getByRole("heading", { name })).toHaveCount(0);
    }
  });

  test("export downloads carry the dashboard's dates and filters, and the menu offers four files", async ({ page }) => {
    const h = await setup(page, "admin", adminDashboard);
    await page.goto("/admin/analytics?range=30d&recruiterId=ta-1");
    await expectReportsLoaded(page);
    await expect.poll(() => lastQuery(h, "admin", "recruiterId")).toBe("ta-1");
    const dashboardQuery = dashboardCalls(h, "admin").at(-1)!;

    await page.getByRole("button", { name: "Export", exact: true }).click();
    await expect(page.getByRole("button", { name: /\((PDF|Excel)\)$/ })).toHaveText([
      "Candidates by stage (PDF)",
      "Candidates by stage (Excel)",
      "Starts and backouts (PDF)",
      "Starts and backouts (Excel)",
    ]);

    const first = page.waitForEvent("download");
    await page.getByRole("button", { name: "Candidates by stage (PDF)" }).click();
    expect((await first).suggestedFilename()).toMatch(/^MEGS_Admin_pipeline_.+\.pdf$/);
    await expect.poll(() => h.api.some((u) => u.pathname === "/api/admin/reports/pipeline")).toBe(true);
    const pipeline = h.api.filter((u) => u.pathname === "/api/admin/reports/pipeline").at(-1)!;
    expect(pipeline.searchParams.get("format")).toBe("pdf");
    expect(pairs(pipeline, ["format"])).toEqual(pairs(dashboardQuery));
    expect(pairs(dashboardQuery)).toEqual(["range=30d", "recruiterId=ta-1"]);

    const second = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await page.getByRole("button", { name: "Starts and backouts (Excel)" }).click();
    expect((await second).suggestedFilename()).toMatch(/^MEGS_Admin_deployments_.+\.xlsx$/);
    await expect.poll(() => h.api.some((u) => u.pathname === "/api/admin/reports/deployments")).toBe(true);
    const deployments = h.api.filter((u) => u.pathname === "/api/admin/reports/deployments").at(-1)!;
    expect(deployments.searchParams.get("format")).toBe("xlsx");
    expect(pairs(deployments, ["format"])).toEqual(pairs(dashboardQuery));
  });

  test("long data: the lists page with a count, and the recruiter table keeps its header on screen", async ({ page }) => {
    await setup(page, "admin", longAdmin);
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);

    const team = await openTab(page, /^Recruiters/);
    await expect(team.getByText("1 to 10 of 35 recruiters")).toBeVisible();
    const headerPosition = await page.locator("#recruiter-table thead").evaluate((el) => getComputedStyle(el).position);
    expect(headerPosition).toBe("sticky");
    await team.getByRole("button", { name: "Next" }).click();
    await team.getByRole("button", { name: "Next" }).click();
    await expect(team.getByText("21 to 30 of 35 recruiters")).toBeVisible();
    await expect(team.getByText("Page 3 of 4")).toBeVisible();
    await team.getByPlaceholder("Recruiter name").fill("Recruiter 15");
    await expect(team.getByRole("button", { name: /^Recruiter 15\./ })).toHaveCount(1);
    await expect(team.getByRole("button", { name: /^Recruiter 1\./ })).toHaveCount(0);

    const requests = await openTab(page, /^Client requests/);
    await expect(requests.getByText("1 to 10 of 60 requests")).toBeVisible();
    await requests.getByRole("button", { name: /^Overdue 5$/ }).click();
    await expect(requests.getByRole("listitem")).toHaveCount(5);
    await expect(requests.getByRole("navigation", { name: "requests pages" })).toHaveCount(0);

    const waiting = await openTab(page, /^Overdue candidates/);
    await expect(waiting.getByText("1 to 8 of 250 candidates")).toBeVisible();
  });

  test("the empty report says so once, and the Needs action strip stays", async ({ page }) => {
    const h = await setup(page, "admin", emptyAdmin);
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);

    await expect(page.getByText("Nothing recorded for these dates.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Needs action" })).toContainText("Nothing needs action right now.");
    await expect(page.getByRole("region", { name: "Right now" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Candidates by stage" })).toHaveCount(0);
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/NaN|—%/);

    // The one suggestion widens the range to 30 days.
    await page.locator("p", { hasText: "Nothing recorded for these dates." }).locator("..").getByRole("button", { name: "Last 30 days" }).click();
    await expect.poll(() => lastQuery(h, "admin", "range")).toBe("30d");
  });

  test("when the report fails, the filter bar stays and Try again is offered", async ({ page }) => {
    await setup(page, "admin", adminDashboard, { fail: true });
    await page.goto("/admin/analytics");
    await expect(page.getByRole("alert").filter({ hasText: /Couldn.t load the reports/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Last 7 days" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("custom dates apply once both are chosen, and an incomplete range says what is missing", async ({ page }) => {
    const h = await setup(page, "admin", adminDashboard);
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);
    await page.getByRole("button", { name: "Custom range" }).click();
    await expect(page.getByRole("alert")).toContainText("Choose a start and an end date.");
    await page.getByLabel("From", { exact: true }).fill("2026-10-01");
    await expect(page.getByRole("alert")).toContainText("Choose a start and an end date.");
    await page.getByLabel("To", { exact: true }).fill("2026-10-10");
    await expect.poll(() => lastQuery(h, "admin", "startDate")).toBe("2026-10-01");
    expect(lastQuery(h, "admin", "endDate")).toBe("2026-10-10");
    expect(lastQuery(h, "admin", "range")).toBe("custom");
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("URL filters and the open list survive a reload", async ({ page }) => {
    const h = await setup(page, "admin", adminDashboard);
    await page.goto("/admin/analytics?range=90d&tab=requests&health=LATE");
    await expectReportsLoaded(page);
    await expect.poll(() => lastQuery(h, "admin", "range")).toBe("90d");
    await expect(page.getByRole("button", { name: "Last 90 days" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("tab", { name: /^Client requests/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel").getByRole("button", { name: /^Overdue or at risk 2$/ })).toHaveAttribute("aria-pressed", "true");

    await page.reload();
    await expectReportsLoaded(page);
    await expect(page.getByRole("button", { name: "Last 90 days" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("tab", { name: /^Client requests/ })).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => lastQuery(h, "admin", "range")).toBe("90d");
  });

  test("a tampered URL falls back to the defaults", async ({ page }) => {
    const h = await setup(page, "admin", adminDashboard);
    await page.goto("/admin/analytics?range=custom&tab=bogus&startDate=not-a-date");
    await expectReportsLoaded(page);
    await expect.poll(() => lastQuery(h, "admin", "range")).toBe("7d");
    expect(lastQuery(h, "admin", "startDate")).toBeNull();
    await expect(page.getByRole("button", { name: "Last 7 days" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Custom range" })).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("tab", { name: /^Overdue candidates/ })).toHaveAttribute("aria-selected", "true");
  });

  test("Tab reaches the filters, the Needs action links, the tiles and the tabs in that order, each with a visible focus", async ({ page }) => {
    await setup(page, "admin", adminDashboard);
    await page.goto("/admin/analytics");
    await expectReportsLoaded(page);

    const trail = await tabToWorkspace(page);
    const filter = trail.findIndex((s) => s.text === "Last 7 days");
    const strip = trail.findIndex((s) => s.region === "Needs action" && s.tag === "a");
    const tile = trail.findIndex((s) => (s.region === "Right now" || s.region === "In these dates") && s.tag === "a");
    const tab = trail.findIndex((s) => s.role === "tab");
    expect(filter, "date filter reached by Tab").toBeGreaterThanOrEqual(0);
    expect(strip, "Needs action link reached by Tab").toBeGreaterThanOrEqual(0);
    expect(tile, "headline tile reached by Tab").toBeGreaterThanOrEqual(0);
    expect(tab, "workspace tab reached by Tab").toBeGreaterThanOrEqual(0);
    expect(filter).toBeLessThan(strip);
    expect(strip).toBeLessThan(tile);
    expect(tile).toBeLessThan(tab);
    for (const i of [filter, strip, tile, tab]) {
      expect(trail[i], trail[i].text).toMatchObject({ focusVisible: true, ring: true });
    }

    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /^Client requests/ })).toBeFocused();
    expect(await focusedStop(page)).toMatchObject({ role: "tab", focusVisible: true, ring: true });
  });

  for (const [name, data] of [["default", adminDashboard], ["long", longAdmin]] as const) {
    test(`fits a 375 px phone without horizontal page scroll (${name} data)`, async ({ page }) => {
      await setup(page, "admin", data);
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/admin/analytics");
      await expectReportsLoaded(page);
      expect(await noHorizontalScroll(page)).toBe(true);
    });
  }

  test("the team leader is sent away from the recruiter reports page", async ({ page }) => {
    await setup(page, "admin", adminDashboard);
    await page.goto("/ta/analytics");
    await expect(page).toHaveURL(/forbidden/);
  });
});

// ---------------------------------------------------------------------------
// Recruiter (/ta/analytics)
// ---------------------------------------------------------------------------

test.describe("Recruiter reports (/ta/analytics)", () => {
  test("the headings read in order and the page has only the recruiter's own lists", async ({ page }) => {
    const h = await setup(page, "recruiter", taDashboard);
    await page.goto("/ta/analytics");
    await expectReportsLoaded(page);

    const headings = await outline(page);
    expect(headings[0]).toBe("Reports");
    expectInOrder(headings, ["Reports", "Needs action", "Headline numbers", "Right now", "In these dates", "Candidates by stage", "Starts and backouts", "Why candidates backed out", "Due soon", "TABS"]);
    // Action items, Overdue candidates, Client requests.
    await expect(page.getByRole("tab")).toHaveCount(3);
    await expect(page.getByRole("tab", { name: /^Recruiters/ })).toHaveCount(0);
    expect(h.unmocked).toEqual([]);
    expect(h.pageErrors).toEqual([]);
  });

  test("headline numbers show their counts; Starts and open requests are not links", async ({ page }) => {
    await setup(page, "recruiter", taDashboard);
    await page.goto("/ta/analytics");
    await expectReportsLoaded(page);

    const now = page.getByRole("region", { name: "Right now" });
    const period = page.getByRole("region", { name: "In these dates" });
    await expect(now.getByRole("link", { name: /^Overdue candidates/ })).toContainText("31");
    await expect(now.getByRole("link", { name: /^Overdue candidates/ })).toContainText("6 estimated from application date");
    await expect(now.getByText("25 of 40 seats filled")).toBeVisible();
    await expect(period.getByText("4 new · 2 redeployed")).toBeVisible();
    // 6 starts now against 4, and a backout rate of 33.3% against 40%, in the previous seven days.
    await expect(period.getByText(/\+2 vs previous 7 days/)).toBeVisible();
    await expect(period.getByText("-6.7 pts")).toBeVisible();
    await expect(period.getByRole("link", { name: /^Backout rate/ })).toContainText("33.3%");
    // The deployments page takes no dates or request filters, so a Starts tile would point at the wrong numbers.
    await expect(page.getByRole("link", { name: /^Starts/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Open requests/ })).toHaveCount(0);
  });

  test("a rate under five samples reads Too few to show (4 cases)", async ({ page }) => {
    await setup(page, "recruiter", smallTa);
    await page.goto("/ta/analytics");
    await expectReportsLoaded(page);
    await expect(page.getByRole("region", { name: "In these dates" }).getByRole("link", { name: /^Backout rate/ })).toContainText("Too few to show (4 cases)");
    const stages = page.locator("#stage-pipeline");
    await stages.getByText("View as table").click();
    await expect(stages.getByRole("row", { name: /Client review/ })).toContainText("Too few to show (4 cases)");
  });

  test("the attention chips open the matching list with its filter", async ({ page }) => {
    await setup(page, "recruiter", taDashboard);
    await page.goto("/ta/analytics");
    await expectReportsLoaded(page);

    const strip = page.getByRole("region", { name: "Needs action" });
    await expect(strip.getByRole("link", { name: /overdue candidates$/ })).toBeVisible();
    await expect(strip.getByRole("link", { name: /tasks waiting on you$/ })).toBeVisible();
    await expect(strip.getByRole("link", { name: /overdue or at-risk request$/ })).toBeVisible();

    await strip.getByRole("link", { name: /overdue candidates$/ }).click();
    const waiting = page.getByRole("tabpanel");
    await expect(page.getByRole("tab", { name: /^Overdue candidates/ })).toHaveAttribute("aria-selected", "true");
    await expect(waiting.getByRole("link", { name: "Mario Reyes" })).toBeVisible();
    await expect(page.locator("#operations")).toBeInViewport();

    await strip.getByRole("link", { name: /overdue or at-risk request$/ }).click();
    await expect(page.getByRole("tab", { name: /^Client requests/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel").getByRole("button", { name: /^Overdue or at risk 1$/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("the tasks chip opens Action items, and ticked overdue rows offer Export selected", async ({ page }) => {
    await setup(page, "recruiter", taDashboard);
    await page.goto("/ta/analytics");
    await expectReportsLoaded(page);

    await page.getByRole("region", { name: "Needs action" }).getByRole("link", { name: /tasks waiting on you$/ }).click();
    await expect(page.getByRole("tab", { name: /^Action items/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel").getByText("Initial Interview Pending Evaluation")).toBeVisible();
    await expect(page.getByRole("tabpanel").getByText("Showing 1 of 41.")).toBeVisible();
    await expect(page).toHaveURL(/tab=actions/);

    await page.getByRole("tab", { name: /^Overdue candidates/ }).click();
    await page.getByRole("checkbox", { name: "Select Mario Reyes" }).check();
    await expect(page.getByText("1 selected")).toBeVisible();
    await page.getByRole("button", { name: "Bulk actions" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Export selected" }).click();
    expect((await download).suggestedFilename()).toMatch(/^MEGS_overdue_candidates_.+\.csv$/);
  });

  test("the overdue list links to the working pages, and shows no recruiter", async ({ page }) => {
    await setup(page, "recruiter", taDashboard);
    await page.goto("/ta/analytics");
    await expectReportsLoaded(page);

    const waiting = page.getByRole("tabpanel");
    await expect(waiting.getByRole("link", { name: "Mario Reyes" })).toHaveAttribute("href", "/ta/applications/811");
    await expect(waiting.getByRole("link", { name: "Industrial Electrician" })).toHaveAttribute("href", "/ta/mrfs/10");
    await expect(waiting.getByText("6 days over")).toBeVisible();
    await expect(waiting.getByText("You", { exact: true })).toHaveCount(0);
    await expect(waiting.getByLabel("Recruiter")).toHaveCount(0);
  });

  test("Quick view moves a candidate to the next stage with a note", async ({ page }) => {
    const h = await setup(page, "recruiter", taDashboard);
    await page.route(
      (url) => url.pathname === "/api/ta/applications/811",
      (route) => route.fulfill(json({ id: 811, status: "COMPLIANCE", complianceRequirements: [], createdAt: "2026-10-01T00:00:00.000Z", user: { email: "mario@example.com" } }))
    );
    let body: unknown = null;
    await page.route(
      (url) => url.pathname === "/api/ta/applications/811/status",
      (route) => {
        body = route.request().postDataJSON();
        return route.fulfill(json({ id: 811, status: "CONTRACT_SIGNING" }));
      }
    );
    await page.goto("/ta/analytics");
    await expectReportsLoaded(page);
    await page.getByRole("button", { name: "Quick view: Mario Reyes" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Note (optional)").fill("All cleared");
    await dialog.getByRole("button", { name: "Move to contract signing" }).click();
    await expect(dialog.getByRole("status")).toContainText("Moved to");
    expect(body).toEqual({ status: "CONTRACT_SIGNING", reason: "All cleared" });
    expect(h.unmocked).toEqual([]);
  });

  test("the client requests list has no recruiter column and links to the request", async ({ page }) => {
    await setup(page, "recruiter", taDashboard);
    await page.goto("/ta/analytics");
    await expectReportsLoaded(page);

    // Two requests are the recruiter's own: the electricians (at risk) and the warehouse (on track).
    const list = await openTab(page, /^Client requests\s+2$/);
    const row = list.getByRole("listitem").filter({ hasText: "10x Industrial Electricians" });
    await expect(row.getByRole("link", { name: "10x Industrial Electricians" })).toHaveAttribute("href", "/ta/mrfs/10");
    await expect(row).toContainText("At risk");
    await expect(list.getByText("Alice Recruiter")).toHaveCount(0);
  });

  test("a stage with overdue candidates lists them in the workspace", async ({ page }) => {
    await setup(page, "recruiter", taDashboard);
    await page.goto("/ta/analytics");
    await expectReportsLoaded(page);
    await page.locator("#stage-pipeline").getByRole("button", { name: /^Requirements, 54 · 26 overdue/ }).click();
    const waiting = page.getByRole("tabpanel");
    await expect(waiting.getByRole("combobox", { name: /^Stage/ })).toHaveValue("COMPLIANCE");
    await expect(waiting.getByRole("link", { name: "Mario Reyes" })).toBeVisible();
  });

  test("the recruiter's calls never carry recruiterId, even when the URL does, and the export matches the screen", async ({ page }) => {
    const h = await setup(page, "recruiter", taDashboard);
    await page.goto("/ta/analytics?range=30d&recruiterId=ta-2");
    await expectReportsLoaded(page);
    await expect.poll(() => dashboardCalls(h, "recruiter").length).toBeGreaterThan(0);
    const dashboardQuery = dashboardCalls(h, "recruiter").at(-1)!;

    await page.getByRole("button", { name: "Export", exact: true }).click();
    await expect(page.getByRole("button", { name: /\((PDF|Excel)\)$/ })).toHaveText([
      "Candidates by stage (PDF)",
      "Candidates by stage (Excel)",
      "Starts and backouts (PDF)",
      "Starts and backouts (Excel)",
    ]);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Starts and backouts (PDF)" }).click();
    expect((await download).suggestedFilename()).toMatch(/^MEGS_TA_deployments_.+\.pdf$/);
    await expect.poll(() => h.api.some((u) => u.pathname === "/api/ta/reports/deployments")).toBe(true);

    const ta = h.api.filter((u) => u.pathname.startsWith("/api/ta/"));
    expect(ta.length).toBeGreaterThan(0);
    for (const u of ta) expect(u.searchParams.has("recruiterId"), u.href).toBe(false);
    expect(pairs(dashboardQuery)).toEqual(["range=30d"]);
    const report = h.api.filter((u) => u.pathname === "/api/ta/reports/deployments").at(-1)!;
    expect(report.searchParams.get("format")).toBe("pdf");
    expect(pairs(report, ["format"])).toEqual(pairs(dashboardQuery));
  });

  test("URL filters and the open list survive a reload", async ({ page }) => {
    const h = await setup(page, "recruiter", taDashboard);
    await page.goto("/ta/analytics?range=90d&tab=requests&health=LATE");
    await expectReportsLoaded(page);
    await expect(page.getByRole("button", { name: "Last 90 days" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("tab", { name: /^Client requests/ })).toHaveAttribute("aria-selected", "true");
    await page.reload();
    await expectReportsLoaded(page);
    await expect(page.getByRole("button", { name: "Last 90 days" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("tab", { name: /^Client requests/ })).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => lastQuery(h, "recruiter", "range")).toBe("90d");
    expect(lastQuery(h, "recruiter", "recruiterId")).toBeNull();
  });

  test("a tampered URL falls back to the defaults and never sends a recruiter", async ({ page }) => {
    const h = await setup(page, "recruiter", taDashboard);
    await page.goto("/ta/analytics?range=custom&tab=recruiters&recruiterId=ta-2");
    await expectReportsLoaded(page);
    await expect.poll(() => lastQuery(h, "recruiter", "range")).toBe("7d");
    expect(lastQuery(h, "recruiter", "recruiterId")).toBeNull();
    await expect(page.getByRole("tab", { name: /^Overdue candidates/ })).toHaveAttribute("aria-selected", "true");
  });

  test("custom dates apply once both are chosen", async ({ page }) => {
    const h = await setup(page, "recruiter", taDashboard);
    await page.goto("/ta/analytics");
    await expectReportsLoaded(page);
    await page.getByRole("button", { name: "Custom range" }).click();
    await expect(page.getByRole("alert")).toContainText("Choose a start and an end date.");
    await page.getByLabel("From", { exact: true }).fill("2026-10-01");
    await page.getByLabel("To", { exact: true }).fill("2026-10-10");
    await expect.poll(() => lastQuery(h, "recruiter", "startDate")).toBe("2026-10-01");
    expect(lastQuery(h, "recruiter", "endDate")).toBe("2026-10-10");
  });

  test("the empty report says so once, and the Needs action strip stays", async ({ page }) => {
    await setup(page, "recruiter", emptyTa);
    await page.goto("/ta/analytics");
    await expectReportsLoaded(page);
    await expect(page.getByText("Nothing recorded for these dates.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Needs action" })).toContainText("Nothing needs action right now.");
    await expect(page.getByRole("region", { name: "Right now" })).toHaveCount(0);
    expect(await page.locator("main").innerText()).not.toMatch(/NaN|—%/);
  });

  test("when the report fails, the filter bar stays and Try again is offered", async ({ page }) => {
    await setup(page, "recruiter", taDashboard, { fail: true });
    await page.goto("/ta/analytics");
    await expect(page.getByRole("alert").filter({ hasText: /Couldn.t load the reports/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Last 7 days" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("Tab reaches the filters, the Needs action links, the tiles and the tabs in that order, each with a visible focus", async ({ page }) => {
    await setup(page, "recruiter", taDashboard);
    await page.goto("/ta/analytics");
    await expectReportsLoaded(page);

    const trail = await tabToWorkspace(page);
    const filter = trail.findIndex((s) => s.text === "Last 7 days");
    const strip = trail.findIndex((s) => s.region === "Needs action" && s.tag === "a");
    const tile = trail.findIndex((s) => (s.region === "Right now" || s.region === "In these dates") && s.tag === "a");
    const tab = trail.findIndex((s) => s.role === "tab");
    expect(filter, "date filter reached by Tab").toBeGreaterThanOrEqual(0);
    expect(strip, "Needs action link reached by Tab").toBeGreaterThanOrEqual(0);
    expect(tile, "headline tile reached by Tab").toBeGreaterThanOrEqual(0);
    expect(tab, "workspace tab reached by Tab").toBeGreaterThanOrEqual(0);
    expect(filter).toBeLessThan(strip);
    expect(strip).toBeLessThan(tile);
    expect(tile).toBeLessThan(tab);
    for (const i of [filter, strip, tile, tab]) {
      expect(trail[i], trail[i].text).toMatchObject({ focusVisible: true, ring: true });
    }
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /^Client requests/ })).toBeFocused();
    expect(await focusedStop(page)).toMatchObject({ role: "tab", focusVisible: true, ring: true });
  });

  test("long data: the lists page with a count", async ({ page }) => {
    await setup(page, "recruiter", longTa);
    await page.goto("/ta/analytics");
    await expectReportsLoaded(page);
    await expect(page.getByRole("tabpanel").getByText("1 to 8 of 250 candidates")).toBeVisible();
    const requests = await openTab(page, /^Client requests\s+60$/);
    await expect(requests.getByText("1 to 10 of 60 requests")).toBeVisible();
    await expect(requests.getByRole("navigation", { name: "requests pages" })).toBeVisible();
  });

  for (const [name, data] of [["default", taDashboard], ["long", longTa]] as const) {
    test(`fits a 375 px phone without horizontal page scroll (${name} data)`, async ({ page }) => {
      await setup(page, "recruiter", data);
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/ta/analytics");
      await expectReportsLoaded(page);
      expect(await noHorizontalScroll(page)).toBe(true);
    });
  }

  test("the recruiter page has none of the team leader's sections", async ({ page }) => {
    await setup(page, "recruiter", taDashboard);
    await page.goto("/ta/analytics");
    await expectReportsLoaded(page);
    for (const name of ["Recruiter workload and results", "Workload compared", "Seats by client", "Waiting too long"]) {
      await expect(page.getByRole("heading", { name })).toHaveCount(0);
    }
    await expect(page.locator("main").getByText("Recruiter", { exact: true })).toHaveCount(0);
  });
});
