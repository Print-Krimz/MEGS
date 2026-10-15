import prisma from "../../utils/prisma.js";
import { isValidDateOnly, manilaDateString, parseManilaDateOnly } from "../../schemas/field-limits.js";
import { ApplicationStatus } from "@prisma/client";
import { ACTIVE_PIPELINE_STATUSES } from "./metric-definitions.js";
import { ownedWhere } from "../ta/ownership.js";

export interface AnalyticsFilterDto {
  range?: "7d" | "30d" | "90d" | "custom";
  startDate?: string;
  endDate?: string;
  clientId?: number;
  mrfId?: number;
  jobPostingId?: number;
  stage?: string;
  recruiterId?: string;
  mineOnly?: boolean;
}

export interface UserScope {
  role: string;
  userId: string;
}

export interface TAPendingActionItem {
  id: string;
  type: "INITIAL_INTERVIEW" | "CLIENT_ENDORSEMENT" | "FINAL_INTERVIEW" | "COMPLIANCE_REVIEW" | "START_CONFIRMATION" | "CONTRACT_SIGNING";
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
export function parseDateRange(filters: AnalyticsFilterDto): { start: Date; end: Date; days: number; dateKeys: string[] } {
  const range = filters.range || "7d";
  const today = manilaDateString();
  const addDays = (day: string, delta: number) => {
    const [year, month, date] = day.split("-").map(Number);
    const result = new Date(Date.UTC(year, month - 1, date + delta));
    return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, "0")}-${String(result.getUTCDate()).padStart(2, "0")}`;
  };

  let startDay: string;
  let endDay: string;
  if (range === "custom") {
    if (!filters.startDate || !filters.endDate || !isValidDateOnly(filters.startDate) || !isValidDateOnly(filters.endDate) || filters.startDate > filters.endDate) {
      throw new Error("Custom date range must contain valid dates with start on or before end.");
    }
    startDay = filters.startDate;
    endDay = filters.endDate;
  } else {
    const days = range === "30d" ? 30 : range === "90d" ? 90 : 7;
    startDay = addDays(today, -(days - 1));
    endDay = today;
  }

  const start = parseManilaDateOnly(startDay);
  const end = new Date(parseManilaDateOnly(endDay).getTime() + 86_400_000 - 1);
  const dateKeys: string[] = [];
  const [startYear, startMonth, startDate] = startDay.split("-").map(Number);
  const [endYear, endMonth, endDate] = endDay.split("-").map(Number);
  const totalDays = Math.floor((Date.UTC(endYear, endMonth - 1, endDate) - Date.UTC(startYear, startMonth - 1, startDate)) / 86_400_000) + 1;
  for (let offset = 0; offset < totalDays; offset++) dateKeys.push(addDays(startDay, offset));
  return { start, end, days: totalDays, dateKeys };
}

// ─────────────────────────────────────────────
// 7. TA PENDING ACTION ITEMS (ACTION QUEUE)
// ─────────────────────────────────────────────
/** The three pending-work queries share one set of conditions so the list and its true count never drift apart. */
const pendingActionScope = (taUserId: string, filters: AnalyticsFilterDto) => {
  // Always the signed-in TA's own work. Finished applications never need action, so they are left out.
  const jobScope: any = { ...ownedWhere.job({ id: taUserId, role: "TALENT_ACQUISITION" }) };
  if (filters.mrfId) jobScope.mrfId = filters.mrfId;
  if (filters.jobPostingId) jobScope.id = filters.jobPostingId;
  if (filters.clientId) jobScope.mrf = { clientId: filters.clientId };
  const application = { jobPosting: jobScope, isArchived: false, status: { notIn: ["BACKOUT", "REJECTED", "ARCHIVED", "TALENT_POOL", "HIRED"] } };

  // A placement waiting for its start to be confirmed: the same deployment ownership rule as everywhere else.
  const deployment: any = { status: "READY_FOR_DEPLOYMENT", ...ownedWhere.deployment({ id: taUserId, role: "TALENT_ACQUISITION" }) };
  if (filters.mrfId) deployment.mrfId = filters.mrfId;
  if (filters.clientId) deployment.clientId = filters.clientId;
  if (filters.jobPostingId) deployment.application = { jobPostingId: filters.jobPostingId };

  const stage = filters.stage;
  return {
    includeInterviews: !stage || stage === "SUBMITTED" || stage === "INITIAL_SCREENING",
    includeFinalInterviews: !stage || stage === "FINAL_INTERVIEW",
    includeEndorsements: !stage || stage === "CLIENT_ENDORSEMENT",
    includeCompliance: !stage || stage === "COMPLIANCE",
    includeContract: !stage || stage === "CONTRACT_SIGNING",
    includeStart: !stage || stage === "DEPLOYED",
    finalWhere: {
      type: "FINAL_INTERVIEW",
      isActive: true,
      OR: [{ result: "PENDING" }, { result: null }],
      application,
    } as any,
    contractWhere: { ...application, status: "CONTRACT_SIGNING" } as any,
    startWhere: deployment,
    interviewWhere: {
      type: "INITIAL_SCREENING",
      isActive: true,
      OR: [{ result: "PENDING" }, { result: null }],
      application,
    } as any,
    endorsementWhere: { outcome: "PENDING", application } as any,
    complianceWhere: { reviewStatus: "SUBMITTED", application } as any,
  };
};

/** Every pending item, not just the ones shown (the list is capped per category). */
export const countTAPendingActions = async (taUserId: string, filters: AnalyticsFilterDto = {}): Promise<number> => {
  const scope = pendingActionScope(taUserId, filters);
  const counts = await Promise.all([
    scope.includeInterviews ? prisma.interview.count({ where: scope.interviewWhere }) : 0,
    scope.includeFinalInterviews ? prisma.interview.count({ where: scope.finalWhere }) : 0,
    scope.includeEndorsements ? prisma.clientEndorsement.count({ where: scope.endorsementWhere }) : 0,
    scope.includeCompliance ? prisma.complianceRequirement.count({ where: scope.complianceWhere }) : 0,
    scope.includeContract ? prisma.application.count({ where: scope.contractWhere }) : 0,
    scope.includeStart ? prisma.deployment.count({ where: scope.startWhere }) : 0,
  ]);
  return counts.reduce((a, b) => a + b, 0);
};

export const getTAPendingActions = async (
  taUserId: string,
  filters: AnalyticsFilterDto = {},
  now: Date = new Date()
): Promise<TAPendingActionItem[]> => {
  const actions: TAPendingActionItem[] = [];
  const scope = pendingActionScope(taUserId, filters);
  const { includeInterviews, includeEndorsements, includeCompliance, interviewWhere, endorsementWhere, complianceWhere } = scope;
  const person = { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } } as const;
  const nameOf = (u?: { email: string; applicantProfile?: { firstName: string | null; lastName: string | null } | null } | null) => {
    const full = `${u?.applicantProfile?.firstName ?? ""} ${u?.applicantProfile?.lastName ?? ""}`.trim();
    return full || u?.email || "Candidate";
  };
  const ageOf = (date: Date) => Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));

  const [finalInterviews, contractWaits, startWaits] = await Promise.all([
    scope.includeFinalInterviews
      ? prisma.interview.findMany({
          where: scope.finalWhere,
          include: { application: { include: { jobPosting: { select: { title: true } }, user: person } } },
          take: 10,
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    scope.includeContract
      ? prisma.application.findMany({
          where: scope.contractWhere,
          select: { id: true, updatedAt: true, jobPosting: { select: { title: true } }, user: person },
          take: 10,
          orderBy: { updatedAt: "asc" },
        })
      : Promise.resolve([]),
    scope.includeStart
      ? prisma.deployment.findMany({
          where: scope.startWhere,
          select: {
            id: true,
            contractStart: true,
            createdAt: true,
            client: { select: { name: true } },
            mrf: { select: { title: true } },
            employee: { select: { user: person } },
          },
          take: 10,
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  for (const iv of finalInterviews) {
    const late = Boolean((iv.scheduledAt && iv.scheduledAt < now) || (iv.complianceDeadline && iv.complianceDeadline < now));
    actions.push({
      id: `final-interview-${iv.id}`,
      type: "FINAL_INTERVIEW",
      title: late ? "Final interview result overdue" : "Record final interview result",
      candidateName: nameOf(iv.application?.user),
      candidateEmail: iv.application?.user?.email,
      jobTitle: iv.application?.jobPosting?.title || "Requisition",
      applicationId: iv.application?.id || 0,
      urgency: late ? "HIGH" : "MEDIUM",
      agingDays: iv.scheduledAt ? ageOf(iv.scheduledAt) : undefined,
      deadline: iv.complianceDeadline ? iv.complianceDeadline.toISOString() : null,
      targetUrl: `/ta/applications/${iv.application?.id}`,
      createdAt: iv.scheduledAt?.toISOString() || iv.createdAt.toISOString(),
    });
  }
  for (const app of contractWaits) {
    actions.push({
      id: `contract-${app.id}`,
      type: "CONTRACT_SIGNING",
      title: "Complete contract signing",
      candidateName: nameOf(app.user),
      candidateEmail: app.user?.email,
      jobTitle: app.jobPosting?.title || "Requisition",
      applicationId: app.id,
      urgency: "MEDIUM",
      agingDays: ageOf(app.updatedAt),
      targetUrl: `/ta/applications/${app.id}`,
      createdAt: app.updatedAt.toISOString(),
    });
  }
  for (const d of startWaits) {
    const due = Boolean(d.contractStart && d.contractStart < now);
    actions.push({
      id: `start-${d.id}`,
      type: "START_CONFIRMATION",
      title: due ? `Confirm start: contract date passed (${d.client?.name ?? "client"})` : `Confirm start (${d.client?.name ?? "client"})`,
      candidateName: nameOf(d.employee?.user),
      candidateEmail: d.employee?.user?.email,
      jobTitle: d.mrf?.title || "Placement",
      applicationId: 0,
      urgency: due ? "HIGH" : "NORMAL",
      agingDays: d.contractStart ? ageOf(d.contractStart) : undefined,
      deadline: d.contractStart ? d.contractStart.toISOString() : null,
      targetUrl: `/ta/deployments/${d.id}`,
      createdAt: d.createdAt.toISOString(),
    });
  }

  // Parallelize the 3 pending action categories concurrently
  const [pendingInterviews, pendingEndorsements, pendingCompliance] = await Promise.all([
    // 1. Initial Interviews requiring action or overdue
    includeInterviews
      ? prisma.interview.findMany({
          where: interviewWhere,
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
          where: endorsementWhere,
          include: {
            client: { select: { name: true, reviewThresholdDays: true } },
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
          where: complianceWhere,
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
        targetUrl: `/ta/applications/${iv.application?.id}`,
        createdAt: iv.scheduledAt?.toISOString() || iv.createdAt.toISOString(),
      });
    }
  }

  if (includeEndorsements && pendingEndorsements) {
    for (const endo of pendingEndorsements) {
      const profile = endo.application?.user?.applicantProfile;
      const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : endo.application?.user?.email || "Candidate";
      const rawThreshold = endo.client?.reviewThresholdDays;
      const threshold = typeof rawThreshold === "number" && rawThreshold > 0 ? rawThreshold : 5;
      const ageDays = Math.max(0, Math.floor((now.getTime() - endo.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
      const isBreached = ageDays >= threshold;
      const clientName = endo.client?.name || "Client";
      const deadline = new Date(endo.createdAt.getTime() + threshold * 86400000).toISOString();

      actions.push({
        id: `endorsement-${endo.id}`,
        type: "CLIENT_ENDORSEMENT",
        title: isBreached
          ? `Client Review Overdue (${ageDays}d / ${threshold}d SLA): ${clientName}`
          : `Awaiting Client Decision (${clientName})`,
        candidateName: name,
        candidateEmail: endo.application?.user?.email,
        jobTitle: endo.application?.jobPosting?.title || "Requisition",
        applicationId: endo.application?.id || 0,
        urgency: isBreached ? "HIGH" : "NORMAL",
        agingDays: ageDays,
        deadline,
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
        targetUrl: `/ta/applications/${comp.application?.id}`,
        createdAt: comp.updatedAt?.toISOString() || comp.createdAt?.toISOString() || new Date().toISOString(),
      });
    }
  }

  // Urgent first, then the item that has been waiting longest.
  const rank = { HIGH: 0, MEDIUM: 1, NORMAL: 2 } as const;
  return actions.sort((x, y) => rank[x.urgency] - rank[y.urgency] || x.createdAt.localeCompare(y.createdAt));
};

// ─────────────────────────────────────────────
// 8. POPULATED FILTER OPTIONS
// ─────────────────────────────────────────────
export const getAnalyticsFilterOptions = async (
  userRole: string,
  userId?: string
): Promise<AnalyticsFilterOptionsResult> => {
  // A TA only sees their own clients, requisitions and openings, and no list of other recruiters.
  const me = userRole === "TALENT_ACQUISITION" && userId ? { id: userId, role: userRole } : null;
  const [clients, mrfs, jobPostings, recruiters] = await Promise.all([
    prisma.client.findMany({
      where: { isActive: true, ...(me ? ownedWhere.client(me) : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.manpowerRequest.findMany({
      where: me ? ownedWhere.mrf(me) : undefined,
      select: { id: true, title: true, clientId: true },
      orderBy: { title: "asc" },
    }),
    prisma.jobPosting.findMany({
      where: me ? ownedWhere.job(me) : undefined,
      select: { id: true, title: true, mrfId: true, postedById: true },
      orderBy: { title: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "TALENT_ACQUISITION", isActive: true, ...(me ? { id: me.id } : {}) },
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
    { key: "CONTRACT_SIGNING", label: "Contract Signing" },
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
export const getPipelineStats = async (actor?: { id: string; role: string }) => {
  const counts = await prisma.application.groupBy({
    by: ["status"],
    where: { isArchived: false, ...(actor ? (ownedWhere.application(actor) as any) : {}) },
    _count: { _all: true },
  });

  const statusBreakdown: Record<string, number> = {};
  for (const c of counts) {
    statusBreakdown[c.status] = c._count._all;
  }
  const activeApplications = ACTIVE_PIPELINE_STATUSES.reduce((sum, status) => sum + (statusBreakdown[status] ?? 0), 0);

  return {
    activeApplications,
    statusBreakdown,
  };
};

export const getComplianceOverview = async (scopeStatuses?: string[], actor?: { id: string; role: string }) => {
  const allowedStatuses = scopeStatuses && scopeStatuses.length > 0
    ? scopeStatuses
    : ["COMPLIANCE", "CONTRACT_SIGNING"];

  const where = {
    application: {
      status: { in: allowedStatuses as any },
      ...(actor ? (ownedWhere.application(actor) as any) : {}),
    },
  };

  const counts = await prisma.complianceRequirement.groupBy({
    by: ["reviewStatus"],
    where,
    _count: { _all: true },
  });

  const total = await prisma.complianceRequirement.count({ where });

  const statusBreakdown: Record<string, number> = {};
  for (const c of counts) {
    statusBreakdown[c.reviewStatus] = c._count._all;
  }

  return {
    totalRequirements: total,
    statusBreakdown,
  };
};
