/**
 * Backend-shaped API fixtures for the production-preview performance harness.
 *
 * Shapes follow the frontend contracts at HEAD (lib/types/* and lib/api/*).
 * Every response uses the `{ success, message, data }` envelope the API client expects.
 * Paginated envelopes ({ items, total, page, pageSize, totalPages }) are returned
 * whenever a `page` or `pageSize` query parameter is present, so later pagination
 * work can be measured with the same fixtures. Current clients that send no such
 * parameter receive the legacy shape.
 *
 * No real backend is contacted: the harness answers every `/api/` request here.
 */

export type IdentityKey = "APPLICANT" | "TALENT_ACQUISITION" | "ADMINISTRATOR";

export interface FixtureScale {
  mrfs: number;
  deployments: number;
  redeploymentQueue: number;
  taApplications: number;
  jobs: number;
  analyticsRequests: number;
  recruiters: number;
  users: number;
  clients: number;
}

/** Small datasets for route baselines. */
export const SMALL_SCALE: FixtureScale = {
  mrfs: 8,
  deployments: 8,
  redeploymentQueue: 8,
  taApplications: 8,
  jobs: 12,
  analyticsRequests: 8,
  recruiters: 3,
  users: 10,
  clients: 6,
};

/** 1,000-row TA lists, 1,000 analytics request rows and 24 recruiters. */
export const LARGE_SCALE: FixtureScale = {
  mrfs: 1000,
  deployments: 1000,
  redeploymentQueue: 1000,
  taApplications: 1000,
  jobs: 60,
  analyticsRequests: 1000,
  recruiters: 24,
  users: 40,
  clients: 24,
};

const ANCHOR_MS = Date.parse("2026-10-15T08:00:00.000Z");
const iso = (daysAgo: number) => new Date(ANCHOR_MS - daysAgo * 86_400_000).toISOString();
const pad = (n: number, width = 4) => String(n).padStart(width, "0");
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const FIRST_NAMES = ["Maria", "Jose", "Angelica", "Miguel", "Kristine", "Ramon", "Liza", "Carlo", "Jasmine", "Paolo"];
const LAST_NAMES = ["Santos", "Reyes", "Cruz", "Bautista", "Garcia", "Mendoza", "Torres", "Flores", "Ramos", "Aquino"];
const TITLES = [
  "Warehouse Associate",
  "Customer Service Representative",
  "Production Operator",
  "Delivery Driver",
  "Sales Associate",
  "Cashier",
  "Electrician",
  "Welder",
];
const LOCATIONS = ["Makati City", "Pasig City", "Quezon City", "Taguig City", "Cebu City", "Davao City"];
const INDUSTRIES = ["Logistics", "Hospitality", "BPO", "Retail", "Agriculture", "Manufacturing"];
const MRF_STATUSES = ["OPEN", "IN_PROGRESS", "FILLED", "ON_HOLD", "OPEN"] as const;
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
const APPLICATION_STATUSES = [
  "REVIEW",
  "INITIAL_SCREENING",
  "CLIENT_ENDORSEMENT",
  "FINAL_INTERVIEW",
  "COMPLIANCE",
  "CONTRACT_SIGNING",
  "DEPLOYED",
] as const;
const DEPLOYMENT_STATUSES = ["ACTIVE", "READY_FOR_DEPLOYMENT", "ENDED", "ACTIVE"] as const;
const QUEUE_STAGES = ["NEEDS_PLACEMENT", "WAITING_FOR_REPLY", "IN_PROGRESS"] as const;

export const IDENTITIES: Record<IdentityKey, Record<string, unknown>> = {
  APPLICANT: {
    id: "perf-applicant-0001",
    email: "applicant.perf@example.test",
    role: "APPLICANT",
    isActive: true,
    accountStatus: "ACTIVE",
    mustChangePassword: false,
    createdAt: iso(400),
    updatedAt: iso(1),
    applicantProfile: { id: 101, firstName: "Maria", lastName: "Santos", photoUrl: null },
  },
  TALENT_ACQUISITION: {
    id: "perf-ta-0001",
    email: "ta.perf@example.test",
    role: "TALENT_ACQUISITION",
    isActive: true,
    accountStatus: "ACTIVE",
    mustChangePassword: false,
    createdAt: iso(400),
    updatedAt: iso(1),
    applicantProfile: { id: 201, firstName: "Ana", lastName: "Reyes", photoUrl: null },
  },
  ADMINISTRATOR: {
    id: "perf-admin-0001",
    email: "admin.perf@example.test",
    role: "ADMINISTRATOR",
    isActive: true,
    accountStatus: "ACTIVE",
    mustChangePassword: false,
    createdAt: iso(400),
    updatedAt: iso(1),
    applicantProfile: null,
  },
};

const TA_ID = "perf-ta-0001";

function makeClients(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    return {
      id: n,
      name: `Client ${pad(n, 2)} ${["Corporation", "Holdings", "Group", "Inc."][index % 4]}`,
      tradeName: null,
      industry: INDUSTRIES[index % INDUSTRIES.length],
      contactName: `Contact Person ${n}`,
      contactEmail: `contact${n}@client.example.test`,
      contactPhone: "0288880000",
      address: "Office address on file",
      street: null,
      barangay: null,
      city: LOCATIONS[index % LOCATIONS.length],
      province: "Metro Manila (NCR)",
      postalCode: "1200",
      isActive: true,
      reviewThresholdDays: 7,
      medicalValidityMonths: 6,
      complianceTemplates: [],
      createdAt: iso(200),
      updatedAt: iso(2),
      _count: { manpowerRequests: 3, deployments: 2 },
    };
  });
}

function makeRecruiter(index: number) {
  return {
    id: `perf-recruiter-${pad(index, 2)}`,
    email: `recruiter${index}@megs.example.test`,
    name: `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[index % LAST_NAMES.length]}`,
  };
}

function makeMrf(index: number, clients: ReturnType<typeof makeClients>) {
  const client = clients[index % clients.length];
  const headcount = 1 + (index % 6);
  const deployedCount = index % (headcount + 1);
  return {
    id: index,
    clientId: client.id,
    title: `${TITLES[index % TITLES.length]} Request ${pad(index)}`,
    description: "Staffing request for the client site. Requirements are listed in the request detail.",
    headcount,
    location: LOCATIONS[index % LOCATIONS.length],
    targetFillDate: iso(-(index % 60)).slice(0, 10),
    priority: PRIORITIES[index % PRIORITIES.length],
    requiredSkills: "Customer service, basic computer skills",
    requiredExperience: "1 year related experience",
    requiredEducation: "High school graduate",
    requiredCertifications: null,
    salaryRangeMin: 16000,
    salaryRangeMax: 22000,
    employmentType: "REGULAR",
    workArrangement: "ON_SITE",
    complianceRequirements: null,
    ageMin: null,
    ageMax: null,
    genderPreference: null,
    tattooPolicy: null,
    status: MRF_STATUSES[index % MRF_STATUSES.length],
    createdById: TA_ID,
    createdAt: iso(index % 300),
    updatedAt: iso(index % 20),
    client,
    jobPostings: [],
    complianceTemplates: [],
    deployments: [],
    _count: { jobPostings: index % 3, deployments: index % 4 },
    fulfillment: {
      mrfId: index,
      headcount,
      deployedCount,
      remainingCount: headcount - deployedCount,
      fulfillmentRate: Math.round((deployedCount / headcount) * 100) / 100,
      isFulfilled: deployedCount >= headcount,
    },
  };
}

function makeJob(index: number, clients: ReturnType<typeof makeClients>) {
  const client = clients[index % clients.length];
  return {
    id: index + 1,
    postedById: TA_ID,
    title: `${TITLES[index % TITLES.length]} Opening ${pad(index + 1, 3)}`,
    description: "Open position at a partner client. Duties and schedule are described in the posting.",
    requirements: "Completed high school. Able to work shifts. Good communication skills.",
    location: LOCATIONS[index % LOCATIONS.length],
    imageUrl: null,
    latitude: null,
    longitude: null,
    status: "OPEN",
    mrfId: (index % 50) + 1,
    mrf: {
      id: (index % 50) + 1,
      title: `${TITLES[index % TITLES.length]} Request ${pad((index % 50) + 1)}`,
      clientId: client.id,
      salaryRangeMin: 16000,
      salaryRangeMax: 22000,
      employmentType: "REGULAR",
      workArrangement: "ON_SITE",
      client: { id: client.id, name: client.name, industry: client.industry, contactName: client.contactName, contactEmail: client.contactEmail },
    },
    createdAt: iso(index % 90),
    updatedAt: iso(index % 10),
    alreadyApplied: false,
    isEvergreen: false,
    _count: { applications: index % 7 },
  };
}

function makeTaApplication(index: number, jobs: ReturnType<typeof makeJob>[]) {
  const job = jobs[index % jobs.length];
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last = LAST_NAMES[(index * 3) % LAST_NAMES.length];
  return {
    id: index + 1,
    status: APPLICATION_STATUSES[index % APPLICATION_STATUSES.length],
    isArchived: false,
    returning: null,
    createdAt: iso(index % 45),
    aiScore: 60 + (index % 35),
    candidateFitScore: 60 + (index % 35),
    candidateFitScoreCalculatedAt: iso(1),
    candidateScoringConfigurationVersion: 1,
    interviewCount: index % 3,
    recruiterDecisionCount: index % 4,
    user: {
      id: `perf-applicant-${pad(index, 4)}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${index}@example.test`,
      applicantProfile: { firstName: first, lastName: last, mobileNumber: "09171234567" },
    },
    jobPosting: {
      id: job.id,
      title: job.title,
      location: job.location,
      mrf: { id: job.mrfId, title: job.mrf.title, clientId: job.mrf.clientId, client: { id: job.mrf.client.id, name: job.mrf.client.name } },
    },
  };
}

function makeProfile() {
  return {
    id: 101,
    userId: "perf-applicant-0001",
    firstName: "Maria",
    middleName: null,
    lastName: "Santos",
    mobileNumber: "09171234567",
    gender: "Female",
    province: null,
    city: null,
    barangay: null,
    postalCode: null,
    dateOfBirth: "1995-04-12",
    birthPlace: "Quezon City",
    nationality: "Filipino",
    civilStatus: "Single",
    height: 158,
    weight: 52,
    religion: null,
    address: null,
    preferredWorkLocations: "Metro Manila",
    latitude: null,
    longitude: null,
    pagibig: null,
    philhealth: null,
    sss: null,
    tin: null,
    photoUrl: null,
    resumeUrl: null,
    professionalSummary: "Hardworking applicant with retail and customer service experience.",
    emergencyContactName: null,
    emergencyContactRelationship: null,
    emergencyContactPhone: null,
    emergencyContactAddress: null,
    additionalNotes: null,
    tattooStatus: "NONE",
    hasNoShowHistory: false,
    isActive: true,
    createdAt: iso(400),
    updatedAt: iso(1),
    workExperiences: [],
    educations: [],
    skills: [],
    trainings: [],
    assets: [],
    characterReferences: [],
  };
}

function makeDeployment(index: number, clients: ReturnType<typeof makeClients>, mrfs: ReturnType<typeof makeMrf>[]) {
  const client = clients[index % clients.length];
  const mrf = mrfs[index % mrfs.length];
  const first = FIRST_NAMES[(index + 2) % FIRST_NAMES.length];
  const last = LAST_NAMES[(index + 5) % LAST_NAMES.length];
  const userId = `perf-worker-${pad(index, 4)}`;
  return {
    id: index + 1,
    employeeId: index + 1,
    applicationId: index + 1,
    clientId: client.id,
    mrfId: mrf.id,
    status: DEPLOYMENT_STATUSES[index % DEPLOYMENT_STATUSES.length],
    site: `${LOCATIONS[index % LOCATIONS.length]} site`,
    contractStart: iso(60 - (index % 120)).slice(0, 10),
    contractEnd: iso(-180).slice(0, 10),
    actualStart: iso(60 - (index % 120)).slice(0, 10),
    actualEnd: null,
    notes: null,
    contractDocumentUrl: null,
    contractStatus: "ACTIVE",
    workerSigned: true,
    workerSignedAt: iso(70),
    clientSigned: true,
    clientSignedAt: iso(69),
    contractTerms: null,
    createdById: TA_ID,
    createdAt: iso(index % 200),
    updatedAt: iso(index % 15),
    employee: {
      id: index + 1,
      userId,
      employeeNumber: `MEGS-${pad(index + 1, 5)}`,
      status: "ACTIVE",
      hireDate: iso(60).slice(0, 10),
      department: "Operations",
      position: TITLES[index % TITLES.length],
      notes: null,
      originatingApplicationId: index + 1,
      createdAt: iso(90),
      updatedAt: iso(2),
      user: {
        id: userId,
        email: `${first.toLowerCase()}.${last.toLowerCase()}${index}@example.test`,
        role: "APPLICANT",
        isActive: true,
        applicantProfile: { id: index + 1000, firstName: first, lastName: last, photoUrl: null },
      },
    },
    client: { id: client.id, name: client.name, industry: client.industry },
    mrf: { id: mrf.id, title: mrf.title, clientId: mrf.clientId },
    application: {
      id: index + 1,
      user: {
        id: userId,
        email: `${first.toLowerCase()}.${last.toLowerCase()}${index}@example.test`,
        applicantProfile: { firstName: first, lastName: last, mobileNumber: "09171234567" },
      },
      jobPosting: { id: (index % 60) + 1, title: TITLES[index % TITLES.length] },
    },
    statusHistory: [],
    agreementVersions: [],
  };
}

function makeQueueItem(index: number, clients: ReturnType<typeof makeClients>) {
  const stage = QUEUE_STAGES[index % QUEUE_STAGES.length];
  const client = clients[index % clients.length];
  const first = FIRST_NAMES[(index + 4) % FIRST_NAMES.length];
  const last = LAST_NAMES[(index + 7) % LAST_NAMES.length];
  return {
    stage,
    pastClients: [{ id: client.id, name: client.name }],
    waitingSince: iso(index % 40),
    pendingInvitation: null,
    id: index + 1,
    employeeNumber: `MEGS-${pad(index + 1, 5)}`,
    applicantProfileId: index + 1000,
    name: `${first} ${last}`,
    previousClient: client.name,
    previousRole: TITLES[index % TITLES.length],
    availableAt: iso(index % 40),
    followUpAt: null,
    ownerId: index % 2 === 0 ? TA_ID : null,
    ownerEmail: index % 2 === 0 ? "ta.perf@example.test" : null,
    notes: null,
    nextAction: stage === "NEEDS_PLACEMENT" ? "Find a matching opening" : "Follow up with the worker",
    applications: [
      { id: index * 2 + 1, status: "REJECTED", title: TITLES[index % TITLES.length], client: client.name },
      { id: index * 2 + 2, status: "BACKOUT", title: TITLES[(index + 1) % TITLES.length], client: client.name },
    ],
  };
}

function makeSuggestions(queueCount: number, jobs: ReturnType<typeof makeJob>[]) {
  const items: Record<number, { total: number; suggestions: unknown[] }> = {};
  for (let index = 0; index < queueCount; index += 1) {
    const suggestions = [0, 1, 2].map((offset) => {
      const job = jobs[(index + offset) % jobs.length];
      return {
        jobId: job.id,
        title: job.title,
        clientName: job.mrf.client.name,
        location: job.location,
        sameClient: offset === 0,
        basis: offset === 0 ? "SAME_CLIENT" : "PROFILE_MATCH",
        matchPercent: offset === 0 ? null : 70 - offset * 5,
      };
    });
    items[index + 1] = { total: suggestions.length, suggestions };
  }
  return items;
}

function makeAdminDashboard(scale: FixtureScale) {
  const clients = makeClients(scale.clients);
  const recruiters = Array.from({ length: scale.recruiters }, (_, index) => makeRecruiter(index));
  const stages = [
    { stage: "APPLIED", label: "Applied" },
    { stage: "INITIAL_SCREENING", label: "Initial screening" },
    { stage: "CLIENT_ENDORSEMENT", label: "Client endorsement" },
    { stage: "FINAL_INTERVIEW", label: "Final interview" },
    { stage: "COMPLIANCE", label: "Compliance" },
    { stage: "CONTRACT_SIGNING", label: "Contract signing" },
    { stage: "DEPLOYED", label: "Deployed" },
  ];
  const requests = Array.from({ length: scale.analyticsRequests }, (_, index) => {
    const client = clients[index % clients.length];
    const owner = recruiters[index % recruiters.length];
    const headcount = 1 + (index % 8);
    const filled = index % (headcount + 1);
    const health = (["ON_TRACK", "AT_RISK", "OVERDUE", "FILLED"] as const)[index % 4];
    return {
      mrfId: index + 1,
      title: `${TITLES[index % TITLES.length]} Request ${pad(index + 1)}`,
      clientId: client.id,
      clientName: client.name,
      status: MRF_STATUSES[index % MRF_STATUSES.length],
      ownerId: owner.id,
      ownerName: owner.name,
      headcount,
      filled,
      openSeats: headcount - filled,
      pipeline: index % 9,
      overdueCandidates: index % 3,
      jobCount: index % 4,
      applicantCount: index % 12,
      attention: index % 5 === 0 ? "NO_APPLICANTS" : null,
      targetFillDate: iso(-(index % 60)).slice(0, 10),
      daysRemaining: (index % 60) - 20,
      health,
      backoutsInPeriod: index % 2,
    };
  });
  const team = recruiters.map((recruiter, index) => ({
    recruiterId: recruiter.id,
    name: recruiter.name,
    active: index % 7,
    overdue: index % 3,
    overdueEstimated: index % 2,
    openRequisitions: index % 5,
    requestedSeats: 4 + (index % 6),
    filledSeats: index % 4,
    fillRate: Math.round(((index % 4) / (4 + (index % 6))) * 100) / 100,
    sentToClient: index % 9,
    newStarts: index % 4,
    redeployStarts: index % 2,
    placed: index % 5,
    backouts: index % 2,
    backoutRate: 0.1,
    medianDaysToFill: 12 + (index % 9),
  }));
  const stageTable = stages.map((row, index) => ({
    stage: row.stage,
    label: row.label,
    inStageNow: 5 + index * 3,
    overdue: index % 3,
    overdueEstimated: index % 2,
    entered: 20 + index * 4,
    backedOut: index % 3,
    avgDaysInStage: 4.5 + index,
    medianDaysInStage: 3 + index,
    slaDays: 7,
  }));
  const dropOff = stages.map((row, index) => ({
    stage: row.stage,
    label: row.label,
    reached: 100 - index * 10,
    inStage: 5 + index,
    movedForward: 80 - index * 9,
    backedOut: index % 3,
    rejected: index % 4,
  }));
  const stuck = Array.from({ length: Math.min(50, requests.length) }, (_, index) => ({
    applicationId: index + 1,
    candidateName: `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[index % LAST_NAMES.length]}`,
    jobTitle: `${TITLES[index % TITLES.length]} Opening`,
    clientName: clients[index % clients.length].name,
    mrfId: index + 1,
    recruiterId: recruiters[index % recruiters.length].id,
    recruiterName: recruiters[index % recruiters.length].name,
    stage: stages[index % stages.length].stage,
    stageLabel: stages[index % stages.length].label,
    daysInStage: 9 + (index % 20),
    slaDays: 7,
    daysOver: 2 + (index % 10),
    urgency: index % 2 === 0 ? "critical" : "overdue",
    estimated: index % 4 === 0,
  }));
  const byRequest = requests.slice(0, 10).map((row) => ({ mrfId: row.mrfId, title: row.title, clientName: row.clientName, count: 2 }));
  const recent = Array.from({ length: 10 }, (_, index) => ({
    applicationId: index + 1,
    candidateName: `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[index % LAST_NAMES.length]}`,
    jobTitle: `${TITLES[index % TITLES.length]} Opening`,
    clientName: clients[index % clients.length].name,
    mrfId: index + 1,
    stage: stages[index % stages.length].stage,
    party: (["APPLICANT", "CLIENT", "AGENCY"] as const)[index % 3],
    reason: "Candidate withdrew",
    occurredAt: iso(index),
  }));
  const trend = {
    granularity: "week",
    points: Array.from({ length: 12 }, (_, index) => ({
      start: iso(7 * (11 - index)).slice(0, 10),
      label: `Week ${index + 1}`,
      newStarts: index % 5,
      redeployStarts: index % 2,
      backouts: index % 2,
      withdrawals: index % 3,
    })),
  };
  const filterOptions = {
    clients: clients.map((client) => ({ id: client.id, name: client.name })),
    mrfs: requests.slice(0, Math.min(200, requests.length)).map((row) => ({ id: row.mrfId, title: row.title, clientId: row.clientId })),
    jobPostings: Array.from({ length: 30 }, (_, index) => ({
      id: index + 1,
      title: `${TITLES[index % TITLES.length]} Opening ${pad(index + 1, 3)}`,
      mrfId: index + 1,
      postedById: TA_ID,
    })),
    recruiters: recruiters.map((recruiter) => ({ id: recruiter.id, email: recruiter.email, name: recruiter.name })),
    stages,
  };
  const kpis = {
    fillRate: 0.62,
    filledSeats: 310,
    requestedSeats: 500,
    openSeats: 190,
    requisitions: { total: requests.length, open: 120, overdue: 14, atRisk: 22, filled: 40 },
    placementsStarted: 58,
    newStarts: 41,
    redeployStarts: 17,
    medianDaysToFill: 18,
    daysToFillSample: 40,
    backoutsAfterClientReview: 6,
    backoutRate: 0.09,
    backoutRateBase: 66,
    activeApplicants: 260,
    overdueCandidates: 31,
    overdueEstimated: 8,
    closedOpenings: 12,
    criticalCandidates: 9,
    unlinkedApplicants: 4,
    staleFilledRequisitions: 1,
  };
  return {
    dateRange: { startDate: iso(30).slice(0, 10), endDate: iso(0).slice(0, 10), days: 30 },
    kpis,
    team,
    unassigned: { applicants: 3, overdue: 1, overdueEstimated: 0, requests: 2, requestedSeats: 4, oldestWaitDays: 12 },
    requests,
    trend,
    backouts: {
      withdrawals: 14,
      backouts: 6,
      byParty: { APPLICANT: 3, CLIENT: 2, AGENCY: 1 },
      byStage: stages.map((row, index) => ({ stage: row.stage, label: row.label, APPLICANT: index % 2, CLIENT: index % 3, AGENCY: 0, total: index % 3 + index % 2 })),
      topReasons: [
        { reason: "Salary expectation", count: 4 },
        { reason: "Schedule conflict", count: 3 },
        { reason: "Accepted another offer", count: 2 },
      ],
      noShows: 2,
      byClient: clients.slice(0, 5).map((client, index) => ({ clientName: client.name, count: index + 1 })),
      byRequest,
      recent,
    },
    clientDecisions: { accepted: 48, declined: 11 },
    stageTable,
    stuck,
    stuckTotal: stuck.length,
    filterOptions,
  };
}

function makeAdminUsers(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const role = index % 5 === 0 ? "ADMINISTRATOR" : index % 2 === 0 ? "TALENT_ACQUISITION" : "APPLICANT";
    return {
      id: `perf-user-${pad(index, 4)}`,
      email: `user${index}@example.test`,
      role,
      isActive: index % 9 !== 0,
      accountStatus: "ACTIVE",
      invitationStatus: "ACCEPTED",
      createdAt: iso(index + 10),
      applicantProfile: { id: index + 2000, firstName: FIRST_NAMES[index % FIRST_NAMES.length], lastName: LAST_NAMES[index % LAST_NAMES.length], photoUrl: null },
    };
  });
}

export const MAX_PAGE_SIZE = 100;

/** Shared server-side state for one browser context: scale and identity drive generated data. */
export interface FixtureContext {
  identity: IdentityKey;
  scale: FixtureScale;
}

export interface FixtureAnswer {
  status: number;
  body: string;
  /** Path that was answered, for bookkeeping. */
  path: string;
}

type Matcher = { method: string; pattern: RegExp; handler: (match: RegExpMatchArray, url: URL, ctx: FixtureContext) => unknown };

const ENDPOINTS: Matcher[] = [];
const endpoint = (method: string, pattern: RegExp, handler: Matcher["handler"]) => ENDPOINTS.push({ method, pattern, handler });

/** Applies `page`/`pageSize` pagination when present, otherwise returns the legacy array. */
function pageOrList<T>(items: T[], url: URL): unknown {
  const hasPage = url.searchParams.has("page") || url.searchParams.has("pageSize");
  if (!hasPage) return items;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const requested = Number(url.searchParams.get("pageSize") ?? url.searchParams.get("limit") ?? 10) || 10;
  const pageSize = clamp(requested, 1, MAX_PAGE_SIZE);
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
  };
}

/** Paginated when the request carries `page` or `pageSize` (the after-build clients always do). */
const isPaged = (url: URL) => url.searchParams.has("page") || url.searchParams.has("pageSize");

const SLA_STATUSES = ["BREACHED", "WARNING", "HEALTHY"] as const;

/** Interview SLA rows. Only the paginated form filters; the legacy form returns every row. */
function makeInterviewRows(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const first = FIRST_NAMES[index % FIRST_NAMES.length];
    const last = LAST_NAMES[(index * 3) % LAST_NAMES.length];
    return {
      interviewId: index + 1,
      applicationId: index + 1,
      candidateName: `${first} ${last}`,
      jobTitle: `${TITLES[index % TITLES.length]} Opening`,
      scheduledAt: iso(index % 10).slice(0, 10),
      deadline: iso((index % 5) - 2).slice(0, 10),
      status: SLA_STATUSES[index % SLA_STATUSES.length],
      currentStage: index % 2 === 0 ? "INITIAL_SCREENING" : "FINAL_INTERVIEW",
    };
  });
}

function queueRows(ctx: FixtureContext) {
  const clients = makeClients(ctx.scale.clients);
  return Array.from({ length: ctx.scale.redeploymentQueue }, (_, index) => makeQueueItem(index, clients));
}

/** Counts over the whole queue, matching backend countRedeploymentStages. */
function queueSummary(rows: Array<{ stage: string }>) {
  const stages: Record<string, number> = { NEEDS_PLACEMENT: 0, WAITING_FOR_REPLY: 0, IN_PROGRESS: 0 };
  for (const row of rows) stages[row.stage] = (stages[row.stage] ?? 0) + 1;
  return { total: rows.length, stages };
}

// Shell requests every authenticated page makes.
endpoint("GET", /^\/api\/me$/, (_m, _u, ctx) => ({ user: IDENTITIES[ctx.identity] }));
endpoint("GET", /^\/api\/config$/, () => ({ MATCH_THRESHOLD: 60, matchThreshold: 60 }));
endpoint("GET", /^\/api\/auth\/mfa\/status$/, () => ({ enabled: false }));
endpoint("GET", /^\/api\/notifications\/unread-count$/, () => ({ count: 0 }));
endpoint("GET", /^\/api\/notifications$/, () => ({ items: [], unreadCount: 0 }));

// Applicant.
endpoint("GET", /^\/api\/applicants\/profile$/, () => makeProfile());
endpoint("GET", /^\/api\/applicant-jobs\/employers\/summary$/, () => ({
  employers: ["Northwind Logistics", "Bayview Hotels", "Pacific Call Works", "Luzon Retail", "Summit Manufacturing"].map((name, index) => ({
    name,
    industry: INDUSTRIES[index % INDUSTRIES.length],
    jobCount: 2 + index,
  })),
}));
endpoint("GET", /^\/api\/applicant-jobs\/jobs$/, (_m, url, ctx) => {
  const jobs = Array.from({ length: ctx.scale.jobs }, (_, index) => makeJob(index, makeClients(ctx.scale.clients)));
  return pageOrList(jobs, url);
});
endpoint("GET", /^\/api\/applicant-jobs\/jobs\/(\d+)$/, (match, _u, ctx) => {
  const job = makeJob(Number(match[1]) - 1, makeClients(ctx.scale.clients));
  return { ...job, salaryRange: "PHP 16,000 - 22,000", department: "Operations", alreadyApplied: false, activeDeployment: { isCurrentlyDeployed: false } };
});
endpoint("GET", /^\/api\/applicant-jobs\/my-applications$/, (_m, url, ctx) => {
  const clients = makeClients(ctx.scale.clients);
  const jobs = Array.from({ length: ctx.scale.jobs }, (_, index) => makeJob(index, clients));
  const items = Array.from({ length: ctx.scale.taApplications }, (_, index) => ({
    id: index + 1,
    jobPostingId: jobs[index % jobs.length].id,
    status: APPLICATION_STATUSES[index % APPLICATION_STATUSES.length],
    isArchived: false,
    createdAt: iso(index % 45),
    resumeAnalysisPending: false,
    jobPosting: { id: jobs[index % jobs.length].id, title: jobs[index % jobs.length].title, location: jobs[index % jobs.length].location },
  }));
  if (url.searchParams.get("summary") === "true") {
    const statusTotals: Record<string, number> = {};
    items.forEach((item) => {
      statusTotals[item.status] = (statusTotals[item.status] ?? 0) + 1;
    });
    return { items, total: items.length, statusTotals };
  }
  return items;
});
endpoint("GET", /^\/api\/applicant-jobs\/invitations$/, () => []);
endpoint("GET", /^\/api\/applicant-jobs\/saved-jobs\/ids$/, () => [2, 5]);
endpoint("GET", /^\/api\/applicant-jobs\/saved-jobs$/, (_m, url, ctx) => pageOrList(makeListJobs(ctx).slice(0, 2), url));
endpoint("GET", /^\/api\/applicant-jobs\/active-deployment$/, () => ({ isCurrentlyDeployed: false }));
endpoint("GET", /^\/api\/applicant-jobs\/my-documents$/, () => []);
endpoint("GET", /^\/api\/applicant-jobs\/my-documents\/library$/, () => []);

function makeListJobs(ctx: FixtureContext) {
  return Array.from({ length: ctx.scale.jobs }, (_, index) => makeJob(index, makeClients(ctx.scale.clients)));
}

// TA.
endpoint("GET", /^\/api\/ta\/dashboard-counts$/, () => ({ openJobs: 12, activeDeployments: 8 }));
endpoint("GET", /^\/api\/ta\/analytics\/pipeline$/, () => ({
  activeApplications: 42,
  statusBreakdown: { REVIEW: 9, INITIAL_SCREENING: 10, CLIENT_ENDORSEMENT: 7, FINAL_INTERVIEW: 6, COMPLIANCE: 5, CONTRACT_SIGNING: 3, DEPLOYED: 2 },
}));
endpoint("GET", /^\/api\/ta\/compliance\/interviews$/, (_m, url) => {
  const rows = makeInterviewRows(12);
  const summary = {
    total: rows.length,
    breached: rows.filter((r) => r.status === "BREACHED").length,
    warning: rows.filter((r) => r.status === "WARNING").length,
    healthy: rows.filter((r) => r.status === "HEALTHY").length,
  };
  if (!isPaged(url)) return { summary, details: rows };
  const sp = url.searchParams;
  const status = sp.get("status");
  const stage = sp.get("stage");
  const position = sp.get("position");
  const search = sp.get("search")?.trim().toLowerCase();
  const sortField = sp.get("sortField") ?? "deadline";
  const direction = sp.get("sortDirection") === "desc" ? -1 : 1;
  const matches = rows
    .filter((r) => (!status || r.status === status) && (!stage || r.currentStage === stage) && (!position || r.jobTitle === position))
    .filter((r) => !search || r.candidateName.toLowerCase().includes(search) || r.jobTitle.toLowerCase().includes(search))
    .sort((a, b) => {
      const c =
        sortField === "candidate" ? a.candidateName.localeCompare(b.candidateName)
        : sortField === "position" ? a.jobTitle.localeCompare(b.jobTitle)
        : sortField === "scheduledAt" ? a.scheduledAt.localeCompare(b.scheduledAt)
        : a.deadline.localeCompare(b.deadline);
      return c * direction || a.applicationId - b.applicationId;
    });
  const positions = [...new Set(rows.map((r) => r.jobTitle))].sort((a, b) => a.localeCompare(b));
  return { ...(pageOrList(matches, url) as object), summary, positions };
});
endpoint("GET", /^\/api\/ta\/applications$/, (_m, url, ctx) => {
  const clients = makeClients(ctx.scale.clients);
  const jobs = Array.from({ length: ctx.scale.jobs }, (_, index) => makeJob(index, clients));
  const items = Array.from({ length: ctx.scale.taApplications }, (_, index) => makeTaApplication(index, jobs));
  return pageOrList(items, url);
});
endpoint("GET", /^\/api\/ta\/jobs$/, (_m, url, ctx) => pageOrList(makeListJobs(ctx), url));
endpoint("GET", /^\/api\/ta\/clients$/, (_m, _u, ctx) => makeClients(ctx.scale.clients));
endpoint("GET", /^\/api\/ta\/mrfs$/, (_m, url, ctx) => {
  const clients = makeClients(ctx.scale.clients);
  const sp = url.searchParams;
  const search = sp.get("search")?.trim().toLowerCase();
  const status = sp.get("status");
  const priority = sp.get("priority");
  const clientId = sp.get("clientId");
  const mrfs = Array.from({ length: ctx.scale.mrfs }, (_, index) => makeMrf(index + 1, clients))
    .filter((m) => (!status || m.status === status) && (!priority || m.priority === priority) && (!clientId || String(m.clientId) === clientId))
    .filter((m) => !search || m.title.toLowerCase().includes(search) || m.client.name.toLowerCase().includes(search));
  return pageOrList(mrfs, url);
});
endpoint("GET", /^\/api\/ta\/deployments$/, (_m, url, ctx) => {
  const clients = makeClients(ctx.scale.clients);
  const mrfs = Array.from({ length: Math.max(1, ctx.scale.mrfs) }, (_, index) => makeMrf(index + 1, clients));
  const sp = url.searchParams;
  const status = sp.get("status");
  const clientId = sp.get("clientId");
  const search = sp.get("search")?.trim().toLowerCase();
  const rows = Array.from({ length: ctx.scale.deployments }, (_, index) => makeDeployment(index, clients, mrfs))
    .filter((d) => (!status || d.status === status) && (!clientId || String(d.clientId) === clientId))
    .filter((d) => {
      if (!search) return true;
      const profile = d.employee.user.applicantProfile;
      return `${profile.firstName} ${profile.lastName}`.toLowerCase().includes(search);
    });
  return pageOrList(rows, url);
});
endpoint("GET", /^\/api\/employees\/redeployment-queue$/, (_m, url, ctx) => {
  const rows = queueRows(ctx);
  const staff = [{ id: TA_ID, email: "ta.perf@example.test" }];
  if (!isPaged(url)) return { staff, items: rows };
  const sp = url.searchParams;
  const stage = sp.get("stage");
  const search = sp.get("search")?.trim().toLowerCase();
  const matches = rows
    .filter((r) => !stage || r.stage === stage)
    .filter((r) => !search || [r.name, r.employeeNumber, r.previousClient ?? "", r.previousRole ?? ""].join(" ").toLowerCase().includes(search));
  return { ...(pageOrList(matches, url) as object), staff, summary: queueSummary(rows) };
});
endpoint("GET", /^\/api\/employees\/redeployment-queue\/summary$/, (_m, _u, ctx) => queueSummary(queueRows(ctx)));
endpoint("GET", /^\/api\/employees\/redeployment-queue\/suggestions$/, (_m, url, ctx) => {
  const clients = makeClients(ctx.scale.clients);
  const jobs = Array.from({ length: ctx.scale.jobs }, (_, index) => makeJob(index, clients));
  const all = makeSuggestions(ctx.scale.redeploymentQueue, jobs);
  const ids = url.searchParams.get("employeeIds");
  if (!ids) return { items: all };
  const wanted = ids.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 25);
  return { items: Object.fromEntries(wanted.filter((id) => all[id]).map((id) => [id, all[id]])) };
});
endpoint("GET", /^\/api\/employees\/credential-alerts$/, () => []);

// Pre-employment and post-deployment Workforce tabs (empty queues; only the request shape matters here).
endpoint("GET", /^\/api\/ta\/analytics\/compliance$/, () => ({
  totalRequirements: 24,
  statusBreakdown: { PENDING: 9, APPROVED: 12, REJECTED: 3 },
}));
endpoint("GET", /^\/api\/ta\/compliance\/queue$/, () => []);
endpoint("GET", /^\/api\/employees$/, (_m, _u, ctx) => {
  const clients = makeClients(ctx.scale.clients);
  const mrfs = Array.from({ length: Math.max(1, ctx.scale.mrfs) }, (_, index) => makeMrf(index + 1, clients));
  return Array.from({ length: Math.min(ctx.scale.deployments, 200) }, (_, index) => makeDeployment(index, clients, mrfs).employee);
});

// Admin.
endpoint("GET", /^\/api\/admin\/users\/summary$/, (_m, _u, ctx) => ({
  totalUsers: ctx.scale.users,
  recruiters: Math.floor(ctx.scale.users / 3),
  administrators: 1,
}));
endpoint("GET", /^\/api\/admin\/users$/, (_m, url, ctx) => pageOrList(makeAdminUsers(ctx.scale.users), url));
endpoint("GET", /^\/api\/admin\/candidate-scoring\/configuration$/, () => ({
  id: 1,
  scope: "GLOBAL",
  status: "ACTIVE",
  version: 3,
  revision: 2,
  knnSettings: { defaultK: 20, maximumK: 60, minimumSimilarity: 0.6, includeArchived: false, excludeRejected: true, excludeCurrentlyHired: true },
  matchThreshold: 60,
  createdById: IDENTITIES.ADMINISTRATOR.id,
  activatedById: IDENTITIES.ADMINISTRATOR.id,
  activatedAt: iso(5),
  supersededAt: null,
  createdAt: iso(5),
  weights: { SKILLS: 30, EXPERIENCE: 25, LOCATION: 15, COMPLIANCE: 10, EDUCATION_CERTIFICATIONS: 20 },
  createdBy: null,
  activatedBy: null,
}));
endpoint("GET", /^\/api\/admin\/candidate-scoring\/configuration\/history$/, () => ({ items: [] }));
endpoint("GET", /^\/api\/admin\/candidate-scoring\/quality-metrics$/, () => ({
  totalCalculated: 120,
  averageFitScore: 71.2,
  minFitScore: 30,
  maxFitScore: 98,
  scoreDistribution: { "0-19": 2, "20-39": 8, "40-59": 24, "60-79": 51, "80-100": 35 },
  knnLatencyP95: 40,
  coveragePercentage: 88,
}));
endpoint("GET", /^\/api\/admin\/maintenance\/backups$/, () => [
  {
    id: "perf-backup-0001",
    filename: "megs-backup-perf.enc",
    sizeBytes: 1048576,
    checksumSha256: null,
    status: "SUCCESS",
    backupType: "SCHEDULED_ROUTINE",
    encryptionMethod: "AES-256-GCM",
    tablesIncluded: [],
    errorMessage: null,
    durationMs: 1200,
    initiatedBy: null,
    progress: null,
    createdAt: iso(1),
    completedAt: iso(1),
  },
]);
endpoint("GET", /^\/api\/admin\/maintenance\/restores$/, () => []);
endpoint("GET", /^\/api\/admin\/audit-logs$/, () =>
  Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    userId: IDENTITIES.ADMINISTRATOR.id,
    action: index % 2 === 0 ? "APPLICATION_STATUS_UPDATED" : "USER_ROLE_UPDATED",
    entity: "Application",
    entityId: index + 1,
    details: null,
    ipAddress: "127.0.0.1",
    createdAt: iso(index),
    user: { id: IDENTITIES.ADMINISTRATOR.id as string, email: "admin.perf@example.test", role: "ADMINISTRATOR", applicantProfile: null },
  })),
);
endpoint("GET", /^\/api\/admin\/analytics\/dashboard$/, (_m, _u, ctx) => makeAdminDashboard(ctx.scale));
endpoint("GET", /^\/api\/admin\/analytics\/filters$/, (_m, _u, ctx) => makeAdminDashboard(ctx.scale).filterOptions);

/** Notifications stream: a finite SSE body, matching the existing e2e shell mocks. */
export const SSE_PATH = /^\/api\/notifications\/stream$/;

/** Returns the fixture response for an API request, or null when no fixture exists. */
export function answerApi(method: string, url: URL, ctx: FixtureContext): FixtureAnswer | null {
  const path = url.pathname;
  for (const matcher of ENDPOINTS) {
    if (matcher.method !== method) continue;
    const match = path.match(matcher.pattern);
    if (!match) continue;
    const data = matcher.handler(match, url, ctx);
    return { status: 200, body: JSON.stringify({ success: true, message: "OK", data }), path };
  }
  return null;
}

/** Byte length of a fixture body, used for payload-size measurements. */
export function fixtureBytes(method: string, url: URL, ctx: FixtureContext): number {
  const answer = answerApi(method, url, ctx);
  return answer ? Buffer.byteLength(answer.body) : 0;
}
