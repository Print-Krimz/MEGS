import prisma from "../../utils/prisma.js";
import { ApplicationStatus } from "@prisma/client";

export interface AnalyticsFilterDto {
  range?: "7d" | "30d" | "90d" | "custom";
  startDate?: string;
  endDate?: string;
  clientId?: number;
  mrfId?: number;
  jobPostingId?: number;
  stage?: string;
  recruiterId?: string;
}

export interface UserScope {
  role: string;
  userId: string;
}

export interface DailyActivityPoint {
  date: string;
  label: string;
  applicationsReceived: number;
  initialInterviewsCompleted: number;
  clientEndorsements: number;
  finalInterviewsCompleted: number;
  candidatesMovedToCompliance: number;
  candidatesDeployed: number;
}

export interface RecruitmentActivityTrendResult {
  dateRange: {
    startDate: string;
    endDate: string;
    days: number;
  };
  series: DailyActivityPoint[];
  totals: {
    applicationsReceived: number;
    initialInterviewsCompleted: number;
    clientEndorsements: number;
    finalInterviewsCompleted: number;
    candidatesMovedToCompliance: number;
    candidatesDeployed: number;
  };
}

export interface AdminOverviewStatsResult {
  totalApplications: number;
  activeCandidates: number;
  talentPoolCandidates: number;
  clientEndorsements: number;
  candidatesInCompliance: number;
  totalDeployments: number;
}

export interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  conversionRate: number; // % from previous stage
  dropoffRate: number;    // % lost from previous stage
  overallConversion: number; // % from total initial applications
}

export interface FunnelAnalyticsResult {
  totalApplications: number;
  stages: FunnelStage[];
}

export interface BottleneckItem {
  stageKey: string;
  stageLabel: string;
  candidateCount: number;
  averageAgingDays: number;
  slaThresholdDays: number;
  overdueCount: number;
  severity: "HEALTHY" | "WARNING" | "CRITICAL";
  description: string;
}

export interface JobDemandItem {
  jobId: number;
  jobTitle: string;
  location: string;
  status: string;
  mrfId?: number | null;
  mrfTitle?: string | null;
  clientId?: number | null;
  clientName?: string | null;
  targetHeadcount: number;
  totalApplications: number;
  activeCandidates: number;
  deployedCount: number;
}

export interface TAOverviewStatsResult {
  myActiveApplications: number;
  initialInterviewsPending: number;
  readyForEndorsement: number;
  pendingClientDecisions: number;
  finalInterviewsPending: number;
  awaitingCompliance: number;
}

export interface TAPendingActionItem {
  id: string;
  type: "INITIAL_INTERVIEW" | "CLIENT_ENDORSEMENT" | "FINAL_INTERVIEW" | "COMPLIANCE_REVIEW";
  title: string;
  candidateName: string;
  candidateEmail?: string;
  jobTitle: string;
  applicationId: number;
  urgency: "HIGH" | "MEDIUM" | "NORMAL";
  agingDays?: number;
  deadline?: string | null;
  targetUrl: string;
  createdAt: string;
}

export interface AnalyticsFilterOptionsResult {
  clients: { id: number; name: string }[];
  mrfs: { id: number; title: string; clientId: number }[];
  jobPostings: { id: number; title: string; mrfId?: number | null; postedById: string }[];
  recruiters: { id: string; email: string; name: string }[];
  stages: { key: string; label: string }[];
}

// ─────────────────────────────────────────────
// DATE RANGE RESOLVER
// ─────────────────────────────────────────────
function parseDateRange(filters: AnalyticsFilterDto): { start: Date; end: Date; days: number; dateKeys: string[] } {
  const range = filters.range || "30d";
  const now = new Date();

  let start: Date;
  let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (range === "custom" && filters.startDate && filters.endDate) {
    start = new Date(filters.startDate);
    start.setHours(0, 0, 0, 0);
    end = new Date(filters.endDate);
    end.setHours(23, 59, 59, 999);
  } else if (range === "7d") {
    start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
  } else if (range === "90d") {
    start = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
  } else {
    // Default 30d
    start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
  }

  if (start > end) {
    const temp = start;
    start = end;
    end = temp;
  }

  const dateKeys: string[] = [];
  const curr = new Date(start);
  while (curr <= end) {
    dateKeys.push(curr.toISOString().split("T")[0]);
    curr.setDate(curr.getDate() + 1);
  }

  const diffMs = end.getTime() - start.getTime();
  const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

  return { start, end, days, dateKeys };
}

// ─────────────────────────────────────────────
// 1. RECRUITMENT ACTIVITY TREND (LINE GRAPH)
// ─────────────────────────────────────────────
export const getRecruitmentActivityTrend = async (
  filters: AnalyticsFilterDto = {},
  userScope?: UserScope
): Promise<RecruitmentActivityTrendResult> => {
  const { start, end, days, dateKeys } = parseDateRange(filters);

  // Common application filter clause
  const appWhere: any = {
    createdAt: { gte: start, lte: end },
  };

  if (userScope?.role === "TALENT_ACQUISITION") {
    appWhere.jobPosting = { postedById: userScope.userId };
  } else if (filters.recruiterId) {
    appWhere.jobPosting = { postedById: filters.recruiterId };
  }

  if (filters.jobPostingId) {
    appWhere.jobPostingId = filters.jobPostingId;
  }
  if (filters.mrfId) {
    appWhere.jobPosting = { ...(appWhere.jobPosting || {}), mrfId: filters.mrfId };
  }
  if (filters.clientId) {
    appWhere.jobPosting = {
      ...(appWhere.jobPosting || {}),
      mrf: { clientId: filters.clientId },
    };
  }
  if (filters.stage) {
    appWhere.status = filters.stage as ApplicationStatus;
  }

  // 2. Initial & Final Interviews Filter
  const interviewWhere: any = {
    OR: [
      { conductedAt: { gte: start, lte: end } },
      { conductedAt: null, createdAt: { gte: start, lte: end }, result: { in: ["PASS", "FAIL", "PASSED", "FAILED"] } },
    ],
  };
  if (userScope?.role === "TALENT_ACQUISITION") {
    interviewWhere.application = { jobPosting: { postedById: userScope.userId } };
  } else if (filters.recruiterId) {
    interviewWhere.application = { jobPosting: { postedById: filters.recruiterId } };
  }
  if (filters.jobPostingId) {
    interviewWhere.application = { ...(interviewWhere.application || {}), jobPostingId: filters.jobPostingId };
  }
  if (filters.mrfId) {
    interviewWhere.application = { ...(interviewWhere.application || {}), jobPosting: { mrfId: filters.mrfId } };
  }
  if (filters.clientId) {
    interviewWhere.application = {
      ...(interviewWhere.application || {}),
      jobPosting: { mrf: { clientId: filters.clientId } },
    };
  }

  // 3. Client Endorsements Filter
  const endorsementWhere: any = {
    createdAt: { gte: start, lte: end },
  };
  if (userScope?.role === "TALENT_ACQUISITION") {
    endorsementWhere.OR = [
      { endorsedById: userScope.userId },
      { application: { jobPosting: { postedById: userScope.userId } } },
    ];
  } else if (filters.recruiterId) {
    endorsementWhere.OR = [
      { endorsedById: filters.recruiterId },
      { application: { jobPosting: { postedById: filters.recruiterId } } },
    ];
  }
  if (filters.clientId) {
    endorsementWhere.clientId = filters.clientId;
  }
  if (filters.jobPostingId) {
    endorsementWhere.application = { ...(endorsementWhere.application || {}), jobPostingId: filters.jobPostingId };
  }
  if (filters.mrfId) {
    endorsementWhere.application = {
      ...(endorsementWhere.application || {}),
      jobPosting: { ...(endorsementWhere.application?.jobPosting || {}), mrfId: filters.mrfId },
    };
  }
  if (filters.stage) {
    endorsementWhere.application = { ...(endorsementWhere.application || {}), status: filters.stage };
  }

  // 4. Candidates Moved to Compliance Filter
  const decisionWhere: any = {
    createdAt: { gte: start, lte: end },
    toStatus: { in: ["COMPLIANCE"] },
  };
  if (userScope?.role === "TALENT_ACQUISITION") {
    decisionWhere.application = { jobPosting: { postedById: userScope.userId } };
  } else if (filters.recruiterId) {
    decisionWhere.application = { jobPosting: { postedById: filters.recruiterId } };
  }
  if (filters.jobPostingId) {
    decisionWhere.application = { ...(decisionWhere.application || {}), jobPostingId: filters.jobPostingId };
  }
  if (filters.mrfId) {
    decisionWhere.application = {
      ...(decisionWhere.application || {}),
      jobPosting: { ...(decisionWhere.application?.jobPosting || {}), mrfId: filters.mrfId },
    };
  }
  if (filters.stage) {
    decisionWhere.application = { ...(decisionWhere.application || {}), status: filters.stage };
  }

  // 5. Candidates Deployed Filter
  const deploymentWhere: any = {
    createdAt: { gte: start, lte: end },
  };
  if (userScope?.role === "TALENT_ACQUISITION") {
    deploymentWhere.OR = [
      { createdById: userScope.userId },
      { application: { jobPosting: { postedById: userScope.userId } } },
    ];
  } else if (filters.recruiterId) {
    deploymentWhere.OR = [
      { createdById: filters.recruiterId },
      { application: { jobPosting: { postedById: filters.recruiterId } } },
    ];
  }
  if (filters.clientId) {
    deploymentWhere.clientId = filters.clientId;
  }
  if (filters.mrfId) {
    deploymentWhere.mrfId = filters.mrfId;
  }
  if (filters.jobPostingId) {
    deploymentWhere.application = { ...(deploymentWhere.application || {}), jobPostingId: filters.jobPostingId };
  }
  if (filters.stage) {
    deploymentWhere.application = { ...(deploymentWhere.application || {}), status: filters.stage };
  }

  // Parallelize the 5 independent trend queries across categories
  const [applications, interviews, endorsements, complianceDecisions, deployments] = await Promise.all([
    prisma.application.findMany({
      where: appWhere,
      select: { id: true, createdAt: true },
    }),
    prisma.interview.findMany({
      where: interviewWhere,
      select: { id: true, type: true, conductedAt: true, createdAt: true, result: true },
    }),
    prisma.clientEndorsement.findMany({
      where: endorsementWhere,
      select: { id: true, createdAt: true },
    }),
    prisma.recruiterDecision.findMany({
      where: decisionWhere,
      select: { id: true, createdAt: true },
    }),
    prisma.deployment.findMany({
      where: deploymentWhere,
      select: { id: true, createdAt: true },
    }),
  ]);

  // Aggregate into contiguous date map
  const dailyMap: Record<string, DailyActivityPoint> = {};
  for (const dateKey of dateKeys) {
    const d = new Date(dateKey + "T00:00:00Z");
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    dailyMap[dateKey] = {
      date: dateKey,
      label,
      applicationsReceived: 0,
      initialInterviewsCompleted: 0,
      clientEndorsements: 0,
      finalInterviewsCompleted: 0,
      candidatesMovedToCompliance: 0,
      candidatesDeployed: 0,
    };
  }

  // Populate applications
  for (const app of applications) {
    const k = app.createdAt.toISOString().split("T")[0];
    if (dailyMap[k]) dailyMap[k].applicationsReceived++;
  }

  // Populate interviews
  for (const iv of interviews) {
    const targetDate = iv.conductedAt || iv.createdAt;
    const k = targetDate.toISOString().split("T")[0];
    if (dailyMap[k]) {
      if (iv.type === "INITIAL_SCREENING") {
        dailyMap[k].initialInterviewsCompleted++;
      } else if (iv.type === "FINAL_INTERVIEW") {
        dailyMap[k].finalInterviewsCompleted++;
      }
    }
  }

  // Populate endorsements
  for (const endo of endorsements) {
    const k = endo.createdAt.toISOString().split("T")[0];
    if (dailyMap[k]) dailyMap[k].clientEndorsements++;
  }

  // Populate compliance decisions
  for (const cd of complianceDecisions) {
    const k = cd.createdAt.toISOString().split("T")[0];
    if (dailyMap[k]) dailyMap[k].candidatesMovedToCompliance++;
  }

  // Populate deployments
  for (const dep of deployments) {
    const k = dep.createdAt.toISOString().split("T")[0];
    if (dailyMap[k]) dailyMap[k].candidatesDeployed++;
  }

  const series = dateKeys.map((k) => dailyMap[k]);

  const totals = {
    applicationsReceived: applications.length,
    initialInterviewsCompleted: interviews.filter((i) => i.type === "INITIAL_SCREENING").length,
    clientEndorsements: endorsements.length,
    finalInterviewsCompleted: interviews.filter((i) => i.type === "FINAL_INTERVIEW").length,
    candidatesMovedToCompliance: complianceDecisions.length,
    candidatesDeployed: deployments.length,
  };

  return {
    dateRange: {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
      days,
    },
    series,
    totals,
  };
};

// ─────────────────────────────────────────────
// 2. ADMIN OVERVIEW KPI STATS
// ─────────────────────────────────────────────
export const getAdminOverviewStats = async (filters: AnalyticsFilterDto = {}): Promise<AdminOverviewStatsResult> => {
  const baseWhere: any = {};
  if (filters.clientId) {
    baseWhere.jobPosting = { mrf: { clientId: filters.clientId } };
  }
  if (filters.mrfId) {
    baseWhere.jobPosting = { ...(baseWhere.jobPosting || {}), mrfId: filters.mrfId };
  }
  if (filters.jobPostingId) {
    baseWhere.jobPostingId = filters.jobPostingId;
  }
  if (filters.recruiterId) {
    baseWhere.jobPosting = { ...(baseWhere.jobPosting || {}), postedById: filters.recruiterId };
  }
  if (filters.stage) {
    baseWhere.status = filters.stage as ApplicationStatus;
  }

  // Construct filter clauses
  const endoWhere: any = {};
  if (filters.clientId) endoWhere.clientId = filters.clientId;
  if (filters.jobPostingId) {
    endoWhere.application = { ...(endoWhere.application || {}), jobPostingId: filters.jobPostingId };
  }
  if (filters.mrfId) {
    endoWhere.application = {
      ...(endoWhere.application || {}),
      jobPosting: { ...(endoWhere.application?.jobPosting || {}), mrfId: filters.mrfId },
    };
  }
  if (filters.stage) {
    endoWhere.application = { ...(endoWhere.application || {}), status: filters.stage };
  }

  const depWhere: any = {};
  if (filters.clientId) depWhere.clientId = filters.clientId;
  if (filters.mrfId) depWhere.mrfId = filters.mrfId;
  if (filters.jobPostingId) {
    depWhere.application = { ...(depWhere.application || {}), jobPostingId: filters.jobPostingId };
  }
  if (filters.stage) {
    depWhere.application = { ...(depWhere.application || {}), status: filters.stage };
  }

  // Parallelize all 6 KPI count queries concurrently
  const [
    totalApplications,
    activeCandidates,
    talentPoolCandidates,
    clientEndorsements,
    candidatesInCompliance,
    totalDeployments,
  ] = await Promise.all([
    // Total Applications
    prisma.application.count({ where: baseWhere }),

    // Active Candidates (non-archived, non-terminal)
    prisma.application.count({
      where: {
        ...baseWhere,
        isArchived: false,
        status: filters.stage ? (filters.stage as ApplicationStatus) : { notIn: [ApplicationStatus.BACKOUT, ApplicationStatus.ARCHIVED, ApplicationStatus.DEPLOYED] },
      },
    }),

    // Talent Pool Candidates
    prisma.talentPoolMembership.count({
      where: { status: "ACTIVE" },
    }),

    // Client Endorsements
    prisma.clientEndorsement.count({ where: endoWhere }),

    // Candidates in Compliance
    prisma.application.count({
      where: {
        ...baseWhere,
        isArchived: false,
        status: "COMPLIANCE",
      },
    }),

    // Total Deployments
    prisma.deployment.count({ where: depWhere }),
  ]);

  return {
    totalApplications,
    activeCandidates,
    talentPoolCandidates,
    clientEndorsements,
    candidatesInCompliance,
    totalDeployments,
  };
};

// ─────────────────────────────────────────────
// 3. ADMIN RECRUITMENT FUNNEL
// ─────────────────────────────────────────────
export const getAdminFunnelAnalytics = async (filters: AnalyticsFilterDto = {}): Promise<FunnelAnalyticsResult> => {
  const where: any = {};
  if (filters.clientId) {
    where.jobPosting = { mrf: { clientId: filters.clientId } };
  }
  if (filters.mrfId) {
    where.jobPosting = { ...(where.jobPosting || {}), mrfId: filters.mrfId };
  }
  if (filters.jobPostingId) {
    where.jobPostingId = filters.jobPostingId;
  }
  if (filters.recruiterId) {
    where.jobPosting = { ...(where.jobPosting || {}), postedById: filters.recruiterId };
  }
  if (filters.stage) {
    where.status = filters.stage as ApplicationStatus;
  }

  const applications = await prisma.application.findMany({
    where,
    select: {
      id: true,
      status: true,
      recruiterDecisions: {
        select: { toStatus: true },
      },
    },
  });

  const total = applications.length;

  const stageOrder = [
    { key: "APPLICATIONS", label: "Applications Received" },
    { key: "INITIAL_SCREENING", label: "Initial Screening" },
    { key: "CLIENT_ENDORSEMENT", label: "Client Endorsement" },
    { key: "FINAL_INTERVIEW", label: "Final Interview" },
    { key: "COMPLIANCE", label: "201 Compliance" },
    { key: "DEPLOYED", label: "Site Deployment" },
  ];

  // Helper to check if candidate reached or passed a stage
  const reachedStage = (app: (typeof applications)[0], stageKey: string): boolean => {
    if (stageKey === "APPLICATIONS") return true;

    const currentStatus = app.status;
    const historyStatuses = app.recruiterDecisions?.map((d) => d.toStatus) || [];
    const allKnown = [currentStatus, ...historyStatuses];

    const hierarchy: Record<string, string[]> = {
      INITIAL_SCREENING: ["INITIAL_SCREENING", "CLIENT_ENDORSEMENT", "FINAL_INTERVIEW", "COMPLIANCE", "DEPLOYED"],
      CLIENT_ENDORSEMENT: ["CLIENT_ENDORSEMENT", "FINAL_INTERVIEW", "COMPLIANCE", "DEPLOYED"],
      FINAL_INTERVIEW: ["FINAL_INTERVIEW", "COMPLIANCE", "DEPLOYED"],
      COMPLIANCE: ["COMPLIANCE", "DEPLOYED"],
      DEPLOYED: ["DEPLOYED"],
    };

    const targetList = hierarchy[stageKey] || [stageKey];
    return allKnown.some((s) => targetList.includes(s));
  };

  const stageCounts: Record<string, number> = {};
  for (const s of stageOrder) {
    stageCounts[s.key] = applications.filter((app) => reachedStage(app, s.key)).length;
  }

  const stages: FunnelStage[] = stageOrder.map((s, idx) => {
    const count = stageCounts[s.key];
    const prevCount = idx === 0 ? count : stageCounts[stageOrder[idx - 1].key];
    const conversionRate = prevCount > 0 ? Number(((count / prevCount) * 100).toFixed(1)) : 0;
    const dropoffRate = Number((100 - conversionRate).toFixed(1));
    const overallConversion = total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;

    return {
      stage: s.key,
      label: s.label,
      count,
      conversionRate,
      dropoffRate,
      overallConversion,
    };
  });

  return {
    totalApplications: total,
    stages,
  };
};

// ─────────────────────────────────────────────
// 4. ADMIN RECRUITMENT BOTTLENECKS & AGING
// ─────────────────────────────────────────────
export const getAdminBottlenecks = async (filters: AnalyticsFilterDto = {}): Promise<BottleneckItem[]> => {
  const now = new Date();
  const where: any = { isArchived: false };

  if (filters.clientId) {
    where.jobPosting = { mrf: { clientId: filters.clientId } };
  }
  if (filters.mrfId) {
    where.jobPosting = { ...(where.jobPosting || {}), mrfId: filters.mrfId };
  }
  if (filters.jobPostingId) {
    where.jobPostingId = filters.jobPostingId;
  }
  if (filters.recruiterId) {
    where.jobPosting = { ...(where.jobPosting || {}), postedById: filters.recruiterId };
  }
  if (filters.stage) {
    where.status = filters.stage as ApplicationStatus;
  }

  const activeApps = await prisma.application.findMany({
    where: {
      ...where,
      status: filters.stage ? (filters.stage as ApplicationStatus) : { in: ["SUBMITTED", "INITIAL_SCREENING", "CLIENT_ENDORSEMENT", "FINAL_INTERVIEW", "COMPLIANCE"] },
    },
    include: {
      interviews: { where: { isActive: true } },
      clientEndorsements: { orderBy: { createdAt: "desc" }, take: 1 },
      complianceRequirements: true,
    },
  });

  // 1. Initial Screening SLA (7-day SLA)
  const screeningApps = activeApps.filter((a) => a.status === "SUBMITTED" || a.status === "INITIAL_SCREENING");
  let screeningTotalDays = 0;
  let screeningOverdue = 0;
  for (const app of screeningApps) {
    const ageDays = Math.max(0, Math.round((now.getTime() - app.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
    screeningTotalDays += ageDays;
    if (ageDays > 7) screeningOverdue++;
  }
  const screeningAvg = screeningApps.length > 0 ? Number((screeningTotalDays / screeningApps.length).toFixed(1)) : 0;

  // 2. Client Decisions Pending
  const endorsementApps = activeApps.filter((a) => a.status === "CLIENT_ENDORSEMENT");
  let endorsementTotalDays = 0;
  let endorsementOverdue = 0;
  for (const app of endorsementApps) {
    const endoDate = app.clientEndorsements?.[0]?.createdAt || app.updatedAt;
    const ageDays = Math.max(0, Math.round((now.getTime() - endoDate.getTime()) / (1000 * 60 * 60 * 24)));
    endorsementTotalDays += ageDays;
    if (ageDays > 3) endorsementOverdue++;
  }
  const endorsementAvg = endorsementApps.length > 0 ? Number((endorsementTotalDays / endorsementApps.length).toFixed(1)) : 0;

  // 3. Final Interviews Pending
  const finalInterviewApps = activeApps.filter((a) => a.status === "FINAL_INTERVIEW");
  let finalTotalDays = 0;
  let finalOverdue = 0;
  for (const app of finalInterviewApps) {
    const ageDays = Math.max(0, Math.round((now.getTime() - app.updatedAt.getTime()) / (1000 * 60 * 60 * 24)));
    finalTotalDays += ageDays;
    if (ageDays > 5) finalOverdue++;
  }
  const finalAvg = finalInterviewApps.length > 0 ? Number((finalTotalDays / finalInterviewApps.length).toFixed(1)) : 0;

  // 4. Compliance Document Clearances
  const complianceApps = activeApps.filter((a) => a.status === "COMPLIANCE");
  let complianceTotalDays = 0;
  let complianceOverdue = 0;
  for (const app of complianceApps) {
    const ageDays = Math.max(0, Math.round((now.getTime() - app.updatedAt.getTime()) / (1000 * 60 * 60 * 24)));
    complianceTotalDays += ageDays;
    const hasPendingOrExpired = app.complianceRequirements?.some(
      (r) => r.reviewStatus === "PENDING" || r.reviewStatus === "SUBMITTED" || (r.deadline && r.deadline < now)
    );
    if (ageDays > 7 || hasPendingOrExpired) complianceOverdue++;
  }
  const complianceAvg = complianceApps.length > 0 ? Number((complianceTotalDays / complianceApps.length).toFixed(1)) : 0;

  const getSeverity = (count: number, overdue: number, avgDays: number, threshold: number): "HEALTHY" | "WARNING" | "CRITICAL" => {
    if (overdue > 3 || avgDays > threshold * 1.5) return "CRITICAL";
    if (overdue > 0 || avgDays > threshold) return "WARNING";
    return "HEALTHY";
  };

  const allBottlenecks: BottleneckItem[] = [
    {
      stageKey: "INITIAL_SCREENING",
      stageLabel: "Initial Screening & Scheduling",
      candidateCount: screeningApps.length,
      averageAgingDays: screeningAvg,
      slaThresholdDays: 7,
      overdueCount: screeningOverdue,
      severity: getSeverity(screeningApps.length, screeningOverdue, screeningAvg, 7),
      description: "Candidates awaiting recruiter evaluation and initial interview completion.",
    },
    {
      stageKey: "CLIENT_ENDORSEMENT",
      stageLabel: "Pending Client Decision",
      candidateCount: endorsementApps.length,
      averageAgingDays: endorsementAvg,
      slaThresholdDays: 3,
      overdueCount: endorsementOverdue,
      severity: getSeverity(endorsementApps.length, endorsementOverdue, endorsementAvg, 3),
      description: "Endorsed candidate profiles awaiting client hiring manager evaluation feedback.",
    },
    {
      stageKey: "FINAL_INTERVIEW",
      stageLabel: "Final Interview Scheduling",
      candidateCount: finalInterviewApps.length,
      averageAgingDays: finalAvg,
      slaThresholdDays: 5,
      overdueCount: finalOverdue,
      severity: getSeverity(finalInterviewApps.length, finalOverdue, finalAvg, 5),
      description: "Candidates shortlisted for final technical/client panel interview.",
    },
    {
      stageKey: "COMPLIANCE",
      stageLabel: "201 Statutory Clearances",
      candidateCount: complianceApps.length,
      averageAgingDays: complianceAvg,
      slaThresholdDays: 7,
      overdueCount: complianceOverdue,
      severity: getSeverity(complianceApps.length, complianceOverdue, complianceAvg, 7),
      description: "Candidates submitting pre-employment clearances (NBI, Medical, SSS, PhilHealth, TIN).",
    },
  ];

  if (filters.stage) {
    const stageMap: Record<string, string> = {
      SUBMITTED: "INITIAL_SCREENING",
      INITIAL_SCREENING: "INITIAL_SCREENING",
      CLIENT_ENDORSEMENT: "CLIENT_ENDORSEMENT",
      FINAL_INTERVIEW: "FINAL_INTERVIEW",
      COMPLIANCE: "COMPLIANCE",
    };
    const targetKey = stageMap[filters.stage] || filters.stage;
    const matched = allBottlenecks.filter((b) => b.stageKey === targetKey);
    return matched.length > 0 ? matched : allBottlenecks;
  }

  return allBottlenecks;
};

// ─────────────────────────────────────────────
// 5. APPLICATIONS BY MRF / JOB POSTING
// ─────────────────────────────────────────────
export const getApplicationsByJobAndMRF = async (filters: AnalyticsFilterDto = {}): Promise<JobDemandItem[]> => {
  const where: any = {};
  if (filters.clientId) {
    where.mrf = { clientId: filters.clientId };
  }
  if (filters.mrfId) {
    where.mrfId = filters.mrfId;
  }
  if (filters.jobPostingId) {
    where.id = filters.jobPostingId;
  }
  if (filters.recruiterId) {
    where.postedById = filters.recruiterId;
  }

  const appWhere: any = {};
  if (filters.stage) {
    appWhere.status = filters.stage as ApplicationStatus;
  }

  const jobs = await prisma.jobPosting.findMany({
    where,
    include: {
      mrf: {
        include: { client: { select: { id: true, name: true } } },
      },
      applications: {
        where: Object.keys(appWhere).length > 0 ? appWhere : undefined,
        select: { id: true, status: true, isArchived: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return jobs.map((j) => {
    const totalApps = j.applications.length;
    const activeApps = j.applications.filter(
      (a) => !a.isArchived && !([ApplicationStatus.BACKOUT, ApplicationStatus.ARCHIVED, ApplicationStatus.DEPLOYED] as ApplicationStatus[]).includes(a.status)
    ).length;
    const deployed = j.applications.filter((a) => a.status === "DEPLOYED").length;

    return {
      jobId: j.id,
      jobTitle: j.title,
      location: j.location || "Philippines",
      status: j.status,
      mrfId: j.mrfId,
      mrfTitle: j.mrf?.title || null,
      clientId: j.mrf?.clientId || null,
      clientName: j.mrf?.client?.name || "Direct Requisition",
      targetHeadcount: j.mrf?.headcount || 1,
      totalApplications: totalApps,
      activeCandidates: activeApps,
      deployedCount: deployed,
    };
  });
};

// ─────────────────────────────────────────────
// 6. TA OVERVIEW STATS (SCOPED TO LOGGED-IN TA)
// ─────────────────────────────────────────────
export const getTAOverviewStats = async (
  taUserId: string,
  filters: AnalyticsFilterDto = {}
): Promise<TAOverviewStatsResult> => {
  const jobScope: any = { postedById: taUserId };
  if (filters.mrfId) jobScope.mrfId = filters.mrfId;
  if (filters.jobPostingId) jobScope.id = filters.jobPostingId;

  const stageFilter = filters.stage ? (filters.stage as ApplicationStatus) : undefined;

  // Parallelize all 6 TA KPI counts concurrently
  const [
    myActiveApplications,
    initialInterviewsPending,
    readyForEndorsement,
    pendingClientDecisions,
    finalInterviewsPending,
    awaitingCompliance,
  ] = await Promise.all([
    // My Active Applications
    prisma.application.count({
      where: {
        jobPosting: jobScope,
        isArchived: false,
        status: stageFilter || { notIn: [ApplicationStatus.BACKOUT, ApplicationStatus.ARCHIVED, ApplicationStatus.DEPLOYED] },
      },
    }),

    // Initial Interviews Pending
    prisma.application.count({
      where: {
        jobPosting: jobScope,
        isArchived: false,
        status: stageFilter || { in: ["SUBMITTED", "INITIAL_SCREENING"] },
      },
    }),

    // Ready for Client Endorsement
    prisma.application.count({
      where: {
        jobPosting: jobScope,
        isArchived: false,
        status: stageFilter || "INITIAL_SCREENING",
        interviews: {
          some: { type: "INITIAL_SCREENING", result: { in: ["PASS", "PASSED"] }, isActive: true },
        },
      },
    }),

    // Pending Client Decisions
    prisma.clientEndorsement.count({
      where: {
        outcome: "PENDING",
        OR: [
          { endorsedById: taUserId },
          { application: { jobPosting: jobScope, ...(stageFilter ? { status: stageFilter } : {}) } },
        ],
      },
    }),

    // Final Interviews Pending
    prisma.application.count({
      where: {
        jobPosting: jobScope,
        isArchived: false,
        status: stageFilter || "FINAL_INTERVIEW",
      },
    }),

    // Awaiting Compliance
    prisma.application.count({
      where: {
        jobPosting: jobScope,
        isArchived: false,
        status: stageFilter || "COMPLIANCE",
      },
    }),
  ]);

  return {
    myActiveApplications,
    initialInterviewsPending,
    readyForEndorsement,
    pendingClientDecisions,
    finalInterviewsPending,
    awaitingCompliance,
  };
};

// ─────────────────────────────────────────────
// 7. TA PENDING ACTION ITEMS (ACTION QUEUE)
// ─────────────────────────────────────────────
export const getTAPendingActions = async (
  taUserId: string,
  filters: AnalyticsFilterDto = {}
): Promise<TAPendingActionItem[]> => {
  const actions: TAPendingActionItem[] = [];
  const now = new Date();

  const jobScope: any = { postedById: taUserId };
  if (filters.mrfId) jobScope.mrfId = filters.mrfId;
  if (filters.jobPostingId) jobScope.id = filters.jobPostingId;

  const stage = filters.stage;
  const includeInterviews = !stage || stage === "SUBMITTED" || stage === "INITIAL_SCREENING";
  const includeEndorsements = !stage || stage === "CLIENT_ENDORSEMENT";
  const includeCompliance = !stage || stage === "COMPLIANCE";

  // Parallelize the 3 pending action categories concurrently
  const [pendingInterviews, pendingEndorsements, pendingCompliance] = await Promise.all([
    // 1. Initial Interviews requiring action or overdue
    includeInterviews
      ? prisma.interview.findMany({
          where: {
            type: "INITIAL_SCREENING",
            isActive: true,
            OR: [{ result: "PENDING" }, { result: null }],
            application: { jobPosting: jobScope, isArchived: false },
          },
          include: {
            application: {
              include: {
                jobPosting: { select: { title: true } },
                user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } },
              },
            },
          },
          take: 10,
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),

    // 2. Client Endorsements pending feedback
    includeEndorsements
      ? prisma.clientEndorsement.findMany({
          where: {
            outcome: "PENDING",
            OR: [
              { endorsedById: taUserId },
              { application: { jobPosting: jobScope } },
            ],
          },
          include: {
            client: { select: { name: true } },
            application: {
              include: {
                jobPosting: { select: { title: true } },
                user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } },
              },
            },
          },
          take: 10,
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),

    // 3. Compliance requirements submitted requiring review
    includeCompliance
      ? prisma.complianceRequirement.findMany({
          where: {
            reviewStatus: "SUBMITTED",
            application: { jobPosting: jobScope, isArchived: false },
          },
          include: {
            application: {
              include: {
                jobPosting: { select: { title: true } },
                user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } },
              },
            },
          },
          take: 10,
          orderBy: { updatedAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  if (includeInterviews && pendingInterviews) {
    for (const iv of pendingInterviews) {
      const profile = iv.application?.user?.applicantProfile;
      const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : iv.application?.user?.email || "Candidate";
      const isOverdue = iv.complianceDeadline && iv.complianceDeadline < now;
      actions.push({
        id: `interview-${iv.id}`,
        type: "INITIAL_INTERVIEW",
        title: isOverdue ? "Overdue Initial Interview" : "Initial Interview Pending Evaluation",
        candidateName: name,
        candidateEmail: iv.application?.user?.email,
        jobTitle: iv.application?.jobPosting?.title || "Requisition",
        applicationId: iv.application?.id || 0,
        urgency: isOverdue ? "HIGH" : "MEDIUM",
        deadline: iv.complianceDeadline ? iv.complianceDeadline.toISOString() : null,
        targetUrl: `/ta/interviews`,
        createdAt: iv.scheduledAt?.toISOString() || iv.createdAt.toISOString(),
      });
    }
  }

  if (includeEndorsements && pendingEndorsements) {
    for (const endo of pendingEndorsements) {
      const profile = endo.application?.user?.applicantProfile;
      const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : endo.application?.user?.email || "Candidate";
      const ageDays = Math.max(0, Math.round((now.getTime() - endo.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
      actions.push({
        id: `endorsement-${endo.id}`,
        type: "CLIENT_ENDORSEMENT",
        title: `Awaiting Client Decision (${endo.client?.name || "Client"})`,
        candidateName: name,
        candidateEmail: endo.application?.user?.email,
        jobTitle: endo.application?.jobPosting?.title || "Requisition",
        applicationId: endo.application?.id || 0,
        urgency: ageDays > 3 ? "HIGH" : "NORMAL",
        agingDays: ageDays,
        targetUrl: `/ta/applications/${endo.application?.id}`,
        createdAt: endo.createdAt.toISOString(),
      });
    }
  }

  if (includeCompliance && pendingCompliance) {
    for (const comp of pendingCompliance) {
      const profile = comp.application?.user?.applicantProfile;
      const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : comp.application?.user?.email || "Candidate";
      actions.push({
        id: `compliance-${comp.id}`,
        type: "COMPLIANCE_REVIEW",
        title: `Review Clearance: ${comp.documentLabel}`,
        candidateName: name,
        candidateEmail: comp.application?.user?.email,
        jobTitle: comp.application?.jobPosting?.title || "Requisition",
        applicationId: comp.application?.id || 0,
        urgency: "MEDIUM",
        deadline: comp.deadline ? comp.deadline.toISOString() : null,
        targetUrl: `/ta/compliance`,
        createdAt: comp.updatedAt?.toISOString() || comp.createdAt?.toISOString() || new Date().toISOString(),
      });
    }
  }

  return actions;
};

// ─────────────────────────────────────────────
// 8. POPULATED FILTER OPTIONS
// ─────────────────────────────────────────────
export const getAnalyticsFilterOptions = async (
  userRole: string,
  userId?: string
): Promise<AnalyticsFilterOptionsResult> => {
  // Parallelize the 4 filter options queries concurrently
  const [clients, mrfs, jobPostings, recruiters] = await Promise.all([
    prisma.client.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.manpowerRequest.findMany({
      select: { id: true, title: true, clientId: true },
      orderBy: { title: "asc" },
    }),
    prisma.jobPosting.findMany({
      select: { id: true, title: true, mrfId: true, postedById: true },
      orderBy: { title: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "TALENT_ACQUISITION", isActive: true },
      select: {
        id: true,
        email: true,
        applicantProfile: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const recruiterOptions = recruiters.map((r) => {
    const name = r.applicantProfile
      ? `${r.applicantProfile.firstName} ${r.applicantProfile.lastName}`.trim()
      : r.email;
    return { id: r.id, email: r.email, name };
  });

  const stages = [
    { key: "SUBMITTED", label: "Submitted" },
    { key: "INITIAL_SCREENING", label: "Initial Screening" },
    { key: "CLIENT_ENDORSEMENT", label: "Client Endorsement" },
    { key: "FINAL_INTERVIEW", label: "Final Interview" },
    { key: "COMPLIANCE", label: "201 Compliance" },
    { key: "DEPLOYED", label: "Deployed" },
  ];

  return {
    clients,
    mrfs,
    jobPostings,
    recruiters: recruiterOptions,
    stages,
  };
};

// ─────────────────────────────────────────────
// 9. LEGACY ANALYTICS HELPERS (PRESERVED)
// ─────────────────────────────────────────────
export const getPipelineStats = async () => {
  const counts = await prisma.application.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const total = await prisma.application.count();
  const archived = await prisma.application.count({ where: { isArchived: true } });

  const statusBreakdown: Record<string, number> = {};
  for (const c of counts) {
    statusBreakdown[c.status] = c._count._all;
  }

  return {
    totalApplications: total,
    archivedApplications: archived,
    statusBreakdown,
  };
};

export const getTimeToFillStats = async (mrfId?: number) => {
  const deployments = await prisma.deployment.findMany({
    where: {
      ...(mrfId ? { mrfId } : {}),
      status: { in: ["ACTIVE", "READY_FOR_DEPLOYMENT"] },
    },
    include: {
      mrf: { select: { id: true, title: true, createdAt: true } },
      application: { select: { id: true, createdAt: true } },
    },
  });

  let totalDays = 0;
  let count = 0;

  const records = deployments.map((d) => {
    const startDate = d.mrf?.createdAt || d.application?.createdAt || d.createdAt;
    const endDate = d.createdAt;
    const diffMs = endDate.getTime() - startDate.getTime();
    const days = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    totalDays += days;
    count++;
    return {
      deploymentId: d.id,
      mrfTitle: d.mrf?.title || "Direct Job",
      daysToFill: days,
      createdDate: startDate,
      deployedDate: endDate,
    };
  });

  const averageDaysToFill = count > 0 ? Number((totalDays / count).toFixed(1)) : 0;

  return {
    averageDaysToFill,
    totalFilledDeployments: count,
    details: records,
  };
};

export const getDeploymentStats = async (clientId?: number) => {
  const counts = await prisma.deployment.groupBy({
    by: ["status"],
    where: clientId ? { clientId } : undefined,
    _count: { _all: true },
  });

  const total = await prisma.deployment.count({
    where: clientId ? { clientId } : undefined,
  });

  const statusBreakdown: Record<string, number> = {};
  for (const c of counts) {
    statusBreakdown[c.status] = c._count._all;
  }

  return {
    totalDeployments: total,
    statusBreakdown,
  };
};

export const getComplianceOverview = async () => {
  const counts = await prisma.complianceRequirement.groupBy({
    by: ["reviewStatus"],
    _count: { _all: true },
  });

  const total = await prisma.complianceRequirement.count();

  const statusBreakdown: Record<string, number> = {};
  for (const c of counts) {
    statusBreakdown[c.reviewStatus] = c._count._all;
  }

  return {
    totalRequirements: total,
    statusBreakdown,
  };
};
