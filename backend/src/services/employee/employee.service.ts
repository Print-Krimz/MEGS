import { maskPhoneNumber } from "../../utils/sms.js";
import prisma from "../../utils/prisma.js";
import { ownedWhere, owns, type Actor } from "../ta/ownership.js";
import { rethrowPlacementConflict } from "./placement-conflict.js";
import { isValidDateOnly, manilaDateString, parseManilaDateOnly, toManilaDateOnly } from "../../schemas/field-limits.js";
import { validateStructuredAddress } from "../../utils/address-validation.js";
import { EmploymentStatus, EmploymentEventType, DeploymentStatus, type Prisma } from "@prisma/client";
import { resolveDocumentSignedUrl, resolveDocumentSignedUrls } from "../document/document.service.js";
import { logAudit } from "../../utils/audit.js";
import { getSecurityControls } from "../../security/security-controls.js";
import { isPageRequested, pageEnvelope, resolvePage, type PageRequest } from "../../utils/pagination.js";
import {
  calculateMRFFulfillment,
  syncMRFFulfillmentStatus,
} from "../ta/ta.mrf.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// DIGITAL 201 AGGREGATE SERVICE
// Consolidated personnel record assembled from normalized domain tables.
// ─────────────────────────────────────────────────────────────────────────────

export interface Digital201Aggregate {
  employee: {
    id: number;
    userId: string;
    employeeNumber: string;
    status: EmploymentStatus;
    hireDate: Date;
    department: string | null;
    position: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  candidate: {
    id: string;
    applicantProfileId: number | null;
    hasPortalAccess: boolean;
    email: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    mobileNumber: string | null;
    address: string | null;
    province: string | null;
    city: string | null;
    dateOfBirth: Date | null;
    birthPlace: string | null;
    nationality: string | null;
    civilStatus: string | null;
    gender: string | null;
    sss: string | null;
    philhealth: string | null;
    pagibig: string | null;
    tin: string | null;
    photoUrl: string | null;
    resumeUrl: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    emergencyContactRelationship: string | null;
    emergencyContactAddress: string | null;
    profile: any;
    workExperiences: any[];
    educations: any[];
    skills: any[];
    trainings: any[];
    assets: any[];
    characterReferences: any[];
    documents: any[];
  };
  skills: string[];
  originatingApplication: any | null;
  compliance: any[];
  deployments: any[];
  employmentHistory: any[];
}

/**
 * Aggregates complete Digital 201 personnel record for an Employee by employeeId.
 */
export const getDigital201ByEmployeeId = async (employeeId: number): Promise<Digital201Aggregate> => {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      user: {
        include: {
          applicantProfile: {
            include: {
              workExperiences: { orderBy: { startDate: "desc" } },
              educations: { orderBy: { startDate: "desc" } },
              skills: { include: { skill: true } },
              trainings: { orderBy: { completionDate: "desc" } },
              assets: true,
              characterReferences: true,
            },
          },
          storedDocuments: {
            where: { deletedAt: null },
            orderBy: { uploadedAt: "desc" },
          },
          applications: {
            orderBy: { createdAt: "desc" },
            include: {
              jobPosting: { include: { mrf: { include: { client: { select: { id: true, name: true } } } } } },
              complianceRequirements: {
                orderBy: { createdAt: "desc" },
                include: { documentVersions: { orderBy: { uploadedAt: "desc" } } },
              },
            },
          },
        },
      },
      originatingApplication: {
        include: {
          jobPosting: {
            select: {
              id: true,
              title: true,
              description: true,
              location: true,
              mrfId: true,
            },
          },
          interviews: { orderBy: { createdAt: "asc" } },
          complianceRequirements: { orderBy: { createdAt: "asc" } },
          postHireDocuments: { where: { isActive: true } },
          recruiterDecisions: { orderBy: { createdAt: "asc" } },
        },
      },
      deployments: {
        include: {
          client: { select: { id: true, name: true, industry: true, address: true } },
          mrf: { select: { id: true, title: true, priority: true } },
          statusHistory: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      },
      employmentEvents: {
        include: {
          actor: { select: { id: true, email: true, role: true } },
        },
        orderBy: { effectiveDate: "desc" },
      },
    },
  });

  if (!employee) {
    throw new Error("Employee record not found");
  }

  const profile = employee.user.applicantProfile;

  let photoUrl = profile?.photoUrl ?? null;
  if (photoUrl && employee.user) {
    try {
      const resolved = await resolveDocumentSignedUrl(photoUrl, employee.user.id, "ADMINISTRATOR");
      if (resolved) photoUrl = resolved;
    } catch {
      photoUrl = null;
    }
  }

  return {
    employee: {
      id: employee.id,
      userId: employee.userId,
      employeeNumber: employee.employeeNumber,
      status: employee.status,
      hireDate: employee.hireDate,
      department: employee.department,
      position: employee.position,
      notes: employee.notes,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    },
    candidate: {
      id: employee.user.id,
      applicantProfileId: profile?.id ?? null,
      hasPortalAccess: employee.user.accountStatus === "ACTIVE",
      email: employee.user.email,
      firstName: profile?.firstName ?? "",
      middleName: profile?.middleName ?? null,
      lastName: profile?.lastName ?? "",
      mobileNumber: profile?.mobileNumber ?? null,
      address: profile?.address ?? null,
      province: profile?.province ?? null,
      city: profile?.city ?? null,
      dateOfBirth: profile?.dateOfBirth ?? null,
      birthPlace: profile?.birthPlace ?? null,
      nationality: profile?.nationality ?? null,
      civilStatus: profile?.civilStatus ?? null,
      gender: profile?.gender ?? null,
      sss: profile?.sss ?? null,
      philhealth: profile?.philhealth ?? null,
      pagibig: profile?.pagibig ?? null,
      tin: profile?.tin ?? null,
      photoUrl,
      resumeUrl: profile?.resumeUrl ?? null,
      emergencyContactName: profile?.emergencyContactName ?? null,
      emergencyContactPhone: profile?.emergencyContactPhone ?? null,
      emergencyContactRelationship: profile?.emergencyContactRelationship ?? null,
      emergencyContactAddress: profile?.emergencyContactAddress ?? null,
      profile: profile
        ? {
            firstName: profile.firstName,
            middleName: profile.middleName,
            lastName: profile.lastName,
            mobileNumber: profile.mobileNumber,
            gender: profile.gender,
            province: profile.province,
            city: profile.city,
            dateOfBirth: profile.dateOfBirth,
            birthPlace: profile.birthPlace,
            nationality: profile.nationality,
            civilStatus: profile.civilStatus,
            address: profile.address,
            pagibig: profile.pagibig,
            philhealth: profile.philhealth,
            sss: profile.sss,
            tin: profile.tin,
            photoUrl,
            resumeUrl: profile.resumeUrl,
            professionalSummary: profile.professionalSummary,
            emergencyContactName: profile.emergencyContactName,
            emergencyContactRelationship: profile.emergencyContactRelationship,
            emergencyContactPhone: profile.emergencyContactPhone,
            emergencyContactAddress: profile.emergencyContactAddress,
          }
        : null,
      workExperiences: profile?.workExperiences ?? [],
      educations: profile?.educations ?? [],
      skills: profile?.skills ?? [],
      trainings: profile?.trainings ?? [],
      assets: profile?.assets ?? [],
      characterReferences: profile?.characterReferences ?? [],
      documents: employee.user.storedDocuments ?? [],
    },
    skills: profile?.skills?.map((s: any) => s.skill?.name || s.name || "").filter(Boolean) ?? [],
    originatingApplication: employee.originatingApplication ?? null,
    compliance: employee.user.applications.flatMap((application) =>
      application.complianceRequirements.map((requirement) => ({
        ...requirement,
        jobTitle: application.jobPosting.title,
        clientName: application.jobPosting.mrf?.client?.name ?? null,
      }))
    ),
    deployments: employee.deployments ?? [],
    employmentHistory: employee.employmentEvents ?? [],
  };
};

/**
 * Aggregates complete Digital 201 personnel record for an Employee by userId.
 */
const CONTRACT_APPLICATION_FIELDS = [
  "contractSigned",
  "contractSignedAt",
  "contractNotes",
  "contractStartDate",
  "contractSignedById",
  "contractDocumentId",
];
const CONTRACT_DEPLOYMENT_FIELDS = [
  "contractDocumentUrl",
  "contractTerms",
  "contractStatus",
  "workerSigned",
  "workerSignedAt",
  "clientSigned",
  "clientSignedAt",
];

const omitKeys = (record: any, keys: string[]) => {
  if (!record || typeof record !== "object") return record;
  const copy = { ...record };
  for (const key of keys) delete copy[key];
  return copy;
};

// Employees read their own Digital 201, but the contract is a TA-only record.
const stripContractFields = (aggregate: Digital201Aggregate): Digital201Aggregate => {
  const agg: any = aggregate;
  if (agg.originatingApplication) {
    agg.originatingApplication = omitKeys(agg.originatingApplication, CONTRACT_APPLICATION_FIELDS);
  }
  if (agg.employee?.originatingApplication) {
    agg.employee.originatingApplication = omitKeys(agg.employee.originatingApplication, CONTRACT_APPLICATION_FIELDS);
  }
  if (Array.isArray(agg.employee?.user?.applications)) {
    agg.employee.user.applications = agg.employee.user.applications.map((a: any) =>
      omitKeys(a, CONTRACT_APPLICATION_FIELDS)
    );
  }
  if (Array.isArray(agg.deployments)) {
    agg.deployments = agg.deployments.map((d: any) => omitKeys(d, CONTRACT_DEPLOYMENT_FIELDS));
  }
  return agg;
};

export const getDigital201ByUserId = async (userId: string): Promise<Digital201Aggregate> => {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!employee) {
    throw new Error("Employee record not found for this user");
  }

  return stripContractFields(await getDigital201ByEmployeeId(employee.id));
};

/**
 * List employees with filtering (e.g. Redeployment Pool: status=AVAILABLE_FOR_REDEPLOYMENT).
 */
export const listEmployees = async (filters: {
  status?: EmploymentStatus;
  department?: string;
  search?: string;
  limit?: number;
  offset?: number;
}, actor?: Actor) => {
  const where: any = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.department) {
    where.department = { contains: filters.department, mode: "insensitive" };
  }

  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim();
    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length > 1) {
      where.AND = tokens.map((token) => ({
        OR: [
          { employeeNumber: { contains: token, mode: "insensitive" } },
          { position: { contains: token, mode: "insensitive" } },
          { department: { contains: token, mode: "insensitive" } },
          { user: { email: { contains: token, mode: "insensitive" } } },
          { user: { applicantProfile: { firstName: { contains: token, mode: "insensitive" } } } },
          { user: { applicantProfile: { lastName: { contains: token, mode: "insensitive" } } } },
        ],
      }));
    } else {
      where.OR = [
        { employeeNumber: { contains: q, mode: "insensitive" } },
        { position: { contains: q, mode: "insensitive" } },
        { department: { contains: q, mode: "insensitive" } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { user: { applicantProfile: { firstName: { contains: q, mode: "insensitive" } } } },
        { user: { applicantProfile: { lastName: { contains: q, mode: "insensitive" } } } },
      ];
    }
  }

  const scoped: any = actor ? { AND: [where, ownedWhere.employeePool(actor)] } : where;
  const [total, items] = await Promise.all([
    prisma.employee.count({ where: scoped }),
    prisma.employee.findMany({
      where: scoped,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            accountStatus: true,
            applicantProfile: {
              select: {
                firstName: true,
                lastName: true,
                mobileNumber: true,
                photoUrl: true,
                city: true,
                province: true,
              },
            },
          },
        },
        deployments: {
          where: { status: { notIn: ["ENDED", "CANCELLED"] } },
          include: {
            client: { select: { id: true, name: true } },
          },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    }),
  ]);

  const photoUrls = await resolveDocumentSignedUrls(
    items.map((item) => ({
      ref: item.user?.applicantProfile?.photoUrl,
      requesterId: item.user?.id ?? "",
      requesterRole: "ADMINISTRATOR",
    }))
  );
  const resolvedItems = items.map((item, index) => {
    if (!item.user?.applicantProfile?.photoUrl) return item;
    return {
      ...item,
      user: {
        ...item.user,
        applicantProfile: { ...item.user.applicantProfile, photoUrl: photoUrls[index] },
      },
    };
  });

  return resolvedItems;
};

export const listEmployeeCredentialAlerts = async (actor?: Actor) => {
  const today = manilaDateString();
  const [year, month, day] = today.split("-").map(Number);
  const horizonDay = new Date(Date.UTC(year, month - 1, day + 30)).toISOString().slice(0, 10);
  const horizon = parseManilaDateOnly(horizonDay);
  const requirements = await prisma.complianceRequirement.findMany({
    where: {
      isRequired: true,
      documentId: { not: null },
      application: {
        isArchived: false,
        user: { employee: { is: { status: { not: "SEPARATED" } } } },
        ...(actor ? ownedWhere.application(actor) : {}),
      },
      OR: [
        { reviewStatus: { in: ["SUBMITTED", "REJECTED", "PENDING"] } },
        { validityStatus: "UNKNOWN" },
        { validityStatus: "HAS_EXPIRY", expiresAt: { lte: horizon } },
      ],
    },
    include: {
      application: {
        select: {
          createdAt: true,
          user: {
            select: {
              applicantProfile: { select: { firstName: true, lastName: true } },
              employee: { select: { id: true, employeeNumber: true, status: true } },
            },
          },
          jobPosting: { select: { title: true, mrf: { select: { client: { select: { name: true } } } } } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const latestByCredential = new Map<string, (typeof requirements)[number]>();
  for (const requirement of requirements) {
    const employee = requirement.application.user.employee;
    if (!employee) continue;
    const key = `${employee.id}:${requirement.documentLabel.trim().toLowerCase()}`;
    if (!latestByCredential.has(key)) latestByCredential.set(key, requirement);
  }

  return [...latestByCredential.values()].map((requirement) => {
    const employee = requirement.application.user.employee!;
    const profile = requirement.application.user.applicantProfile;
    const expiryDay = requirement.expiresAt ? toManilaDateOnly(requirement.expiresAt) : null;
    const requestOverdue = requirement.updateRequestedAt && !requirement.updateRequestCompletedAt && requirement.updateRequestDeadline && toManilaDateOnly(requirement.updateRequestDeadline) < today;
    const alertType = requestOverdue ? "UPDATE_OVERDUE" : requirement.reviewStatus !== "APPROVED"
      ? "REVIEW_REQUIRED"
      : requirement.validityStatus === "UNKNOWN"
        ? "VALIDITY_UNKNOWN"
        : expiryDay && expiryDay < today
          ? "EXPIRED"
          : "EXPIRING_SOON";
    return {
      requirementId: requirement.id,
      documentId: requirement.documentId,
      documentLabel: requirement.documentLabel,
      reviewStatus: requirement.reviewStatus,
      validityStatus: requirement.validityStatus,
      issuedAt: requirement.issuedAt,
      expiresAt: requirement.expiresAt,
      updateRequestReason: requirement.updateRequestReason,
      updateRequestDeadline: requirement.updateRequestDeadline,
      alertType,
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      employeeName: `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() || employee.employeeNumber,
      employeeStatus: employee.status,
      clientName: requirement.application.jobPosting.mrf?.client?.name || "Client not recorded",
      jobTitle: requirement.application.jobPosting.title,
    };
  });
};

export type RedeploymentStageName = "NEEDS_PLACEMENT" | "WAITING_FOR_REPLY" | "IN_PROGRESS";
const REDEPLOYMENT_STAGE_ORDER: Record<RedeploymentStageName, number> = { NEEDS_PLACEMENT: 0, WAITING_FOR_REPLY: 1, IN_PROGRESS: 2 };
const REDEPLOYMENT_POOL_WHERE: Prisma.EmployeeWhereInput = { status: "AVAILABLE_FOR_REDEPLOYMENT", deployments: { none: { status: { notIn: ["ENDED", "CANCELLED"] } } } };
const REDEPLOYMENT_POOL_ORDER: Prisma.EmployeeOrderByWithRelationInput[] = [{ redeploymentFollowUpAt: "asc" }, { updatedAt: "asc" }, { id: "asc" }];
const redeploymentApplicationWhere = (actor?: Actor) => ({ isArchived: false, status: { notIn: ["BACKOUT", "ARCHIVED", "REJECTED", "DEPLOYED"] }, ...(actor ? ownedWhere.application(actor) : {}) }) as any;
const redeploymentStageOf = (hasApplications: boolean, hasInvitation: boolean): RedeploymentStageName =>
  hasApplications ? "IN_PROGRESS" : hasInvitation ? "WAITING_FOR_REPLY" : "NEEDS_PLACEMENT";
const DAY_MS = 86_400_000;

export interface RedeploymentQueueOptions extends PageRequest {
  search?: string;
  stage?: RedeploymentStageName;
}

const loadRedeploymentStaff = () =>
  prisma.user.findMany({ where: { role: { in: ["TALENT_ACQUISITION", "ADMINISTRATOR"] }, isActive: true }, select: { id: true, email: true }, orderBy: { email: "asc" } });

// Every client the worker actually started at. A new application to any of these skips
// screening, using the same rule as application submission. Grouped by worker once.
const loadStartedPlacements = async (employeeIds: number[]) => {
  const byEmployee = new Map<number, Array<{ id: number; name: string }>>();
  if (employeeIds.length === 0) return byEmployee;
  const placements = await prisma.deployment.findMany({
    where: {
      employeeId: { in: employeeIds },
      status: { in: ["ACTIVE", "ENDED"] },
      OR: [
        { actualStart: { not: null } },
        { statusHistory: { some: { toStatus: "ACTIVE" } } },
        { status: "ENDED", contractStart: { not: null } },
      ],
    },
    select: { employeeId: true, clientId: true, client: { select: { name: true } } },
    distinct: ["employeeId", "clientId"],
  });
  for (const placement of placements) {
    const clients = byEmployee.get(placement.employeeId);
    const client = { id: placement.clientId, name: placement.client.name };
    if (clients) clients.push(client);
    else byEmployee.set(placement.employeeId, [client]);
  }
  return byEmployee;
};

const findRedeploymentEmployees = (actor?: Actor, ids?: number[]) =>
  prisma.employee.findMany({
    where: { ...REDEPLOYMENT_POOL_WHERE, ...(ids ? { id: { in: ids } } : {}) },
    orderBy: REDEPLOYMENT_POOL_ORDER,
    include: {
      redeploymentOwner: { select: { id: true, email: true } },
      deployments: { where: { status: "ENDED" }, orderBy: { actualEnd: "desc" }, take: 1, include: { client: { select: { name: true } }, mrf: { select: { title: true } }, application: { select: { jobPosting: { select: { title: true } } } }, statusHistory: { where: { toStatus: "ENDED" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } } },
      user: { select: {
        accountStatus: true,
        phoneNumber: true,
        applicantProfile: { select: { id: true, firstName: true, lastName: true, mobileNumber: true, invitations: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, responseChannel: true, jobPosting: { select: { title: true } } } } } },
        applications: { where: redeploymentApplicationWhere(actor), orderBy: { createdAt: "desc" }, select: { id: true, status: true, jobPosting: { select: { title: true, mrf: { select: { client: { select: { name: true } } } } } } } },
      } },
    },
  });

type RedeploymentEmployee = Awaited<ReturnType<typeof findRedeploymentEmployees>>[number];

const mapRedeploymentRow = (employee: RedeploymentEmployee, pastClients: Array<{ id: number; name: string }>) => {
  const previous = employee.deployments[0];
  const profile = employee.user.applicantProfile;
  const applications = employee.user.applications;
  const invitation = profile?.invitations?.[0];
  const stage = redeploymentStageOf(applications.length > 0, Boolean(invitation));
  const mobile = employee.user.phoneNumber || profile?.mobileNumber;
  const maskedMobile = mobile ? maskPhoneNumber(mobile) : null;
  return {
    stage,
    pastClients,
    // Falls back to when the last assignment ended when the availability date was never recorded.
    waitingSince: employee.redeploymentAvailableAt ?? previous?.actualEnd ?? previous?.statusHistory[0]?.createdAt ?? null,
    pendingInvitation: invitation ? { id: invitation.id, title: invitation.jobPosting.title, responseChannel: invitation.responseChannel, maskedMobile } : null,
    hasPortalAccess: employee.user.accountStatus === "ACTIVE",
    hasMobile: Boolean(employee.user.phoneNumber || profile?.mobileNumber),
    maskedMobile: maskedMobile,
    id: employee.id, employeeNumber: employee.employeeNumber,
    applicantProfileId: profile?.id ?? null,
    name: `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() || employee.employeeNumber,
    previousClient: previous?.client.name ?? null,
    previousRole: previous?.application?.jobPosting.title || previous?.mrf?.title || employee.position,
    availableAt: employee.redeploymentAvailableAt, followUpAt: employee.redeploymentFollowUpAt,
    ownerId: employee.redeploymentOwnerId, ownerEmail: employee.redeploymentOwner?.email ?? null, notes: employee.redeploymentNotes,
    nextAction: applications.length ? "Application in progress" : invitation ? "Waiting for applicant response" : "Find a placement",
    applications: applications.map((application) => ({ id: application.id, status: application.status, title: application.jobPosting.title, client: application.jobPosting.mrf?.client.name ?? null })),
  };
};

/** Lean projection of the whole shared pool: only what stage, search, and ordering need. */
const loadRedeploymentIndex = async (actor?: Actor) => {
  const employees = await prisma.employee.findMany({
    where: REDEPLOYMENT_POOL_WHERE,
    orderBy: REDEPLOYMENT_POOL_ORDER,
    select: {
      id: true,
      employeeNumber: true,
      position: true,
      redeploymentAvailableAt: true,
      deployments: { where: { status: "ENDED" }, orderBy: { actualEnd: "desc" }, take: 1, select: { actualEnd: true, client: { select: { name: true } }, mrf: { select: { title: true } }, application: { select: { jobPosting: { select: { title: true } } } }, statusHistory: { where: { toStatus: "ENDED" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } } },
      user: { select: {
        applicantProfile: { select: { firstName: true, lastName: true, invitations: { where: { status: "PENDING" }, take: 1, select: { id: true } } } },
        applications: { where: redeploymentApplicationWhere(actor), take: 1, select: { id: true } },
      } },
    },
  });
  return employees.map((employee) => {
    const previous = employee.deployments[0];
    const profile = employee.user.applicantProfile;
    const name = `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() || employee.employeeNumber;
    const previousClient = previous?.client.name ?? "";
    const previousRole = previous?.application?.jobPosting.title || previous?.mrf?.title || employee.position || "";
    const waitingSince = employee.redeploymentAvailableAt ?? previous?.actualEnd ?? previous?.statusHistory[0]?.createdAt ?? null;
    return {
      id: employee.id,
      stage: redeploymentStageOf(employee.user.applications.length > 0, Boolean(profile?.invitations?.length)),
      waitingSince,
      searchText: `${name} ${employee.employeeNumber} ${previousClient} ${previousRole}`.toLowerCase(),
    };
  });
};

const countRedeploymentStages = (index: Array<{ stage: RedeploymentStageName }>) => {
  const stages: Record<RedeploymentStageName, number> = { NEEDS_PLACEMENT: 0, WAITING_FOR_REPLY: 0, IN_PROGRESS: 0 };
  for (const row of index) stages[row.stage] += 1;
  return { total: index.length, stages };
};

/** Authoritative stage counts for the whole shared queue (workforce badge, stage filter tiles). */
export const getRedeploymentQueueSummary = async (actor?: Actor) => {
  const inProgress: Prisma.EmployeeWhereInput = { user: { is: { applications: { some: redeploymentApplicationWhere(actor) } } } };
  const [total, inProgressCount, waiting] = await Promise.all([
    prisma.employee.count({ where: REDEPLOYMENT_POOL_WHERE }),
    prisma.employee.count({ where: { AND: [REDEPLOYMENT_POOL_WHERE, inProgress] } }),
    // Same precedence as redeploymentStageOf: an open application outranks a pending invitation.
    prisma.employee.count({
      where: { AND: [REDEPLOYMENT_POOL_WHERE, { NOT: inProgress }, { user: { is: { applicantProfile: { is: { invitations: { some: { status: "PENDING" } } } } } } }] },
    }),
  ]);
  return { total, stages: { NEEDS_PLACEMENT: total - inProgressCount - waiting, WAITING_FOR_REPLY: waiting, IN_PROGRESS: inProgressCount } };
};

const listRedeploymentQueuePage = async (actor: Actor | undefined, options: RedeploymentQueueOptions) => {
  const [index, staff] = await Promise.all([loadRedeploymentIndex(actor), loadRedeploymentStaff()]);
  const summary = countRedeploymentStages(index);
  const search = options.search?.trim().toLowerCase();
  const now = Date.now();
  const daysWaiting = (since: Date | null) => (since ? Math.max(0, Math.floor((now - since.getTime()) / DAY_MS)) : -1);
  // Needs placement first, then longest-waiting first; array sort is stable so the pool order breaks ties.
  const matches = index
    .filter((row) => (!options.stage || row.stage === options.stage) && (!search || row.searchText.includes(search)))
    .sort((a, b) => REDEPLOYMENT_STAGE_ORDER[a.stage] - REDEPLOYMENT_STAGE_ORDER[b.stage] || daysWaiting(b.waitingSince) - daysWaiting(a.waitingSince));
  const { page, pageSize, skip, take } = resolvePage(options);
  const pageIds = matches.slice(skip, skip + take).map((row) => row.id);
  const [employees, placements] = await Promise.all([
    pageIds.length ? findRedeploymentEmployees(actor, pageIds) : Promise.resolve([]),
    loadStartedPlacements(pageIds),
  ]);
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const items = pageIds.flatMap((id) => {
    const employee = byId.get(id);
    return employee ? [mapRedeploymentRow(employee, placements.get(id) ?? [])] : [];
  });
  return { ...pageEnvelope(items, matches.length, page, pageSize), staff, summary };
};

export const listRedeploymentQueue = async (actor?: Actor, options: RedeploymentQueueOptions = {}) => {
  if (isPageRequested(options)) return listRedeploymentQueuePage(actor, options);
  const [employees, staff] = await Promise.all([findRedeploymentEmployees(actor), loadRedeploymentStaff()]);
  const placements = await loadStartedPlacements(employees.map((employee) => employee.id));
  return { staff, items: employees.map((employee) => mapRedeploymentRow(employee, placements.get(employee.id) ?? [])) };
};

export const updateRedeploymentFollowUp = async (id: number, actorId: string, data: { ownerId?: string | null; followUpAt?: string | null; notes?: string }, actor?: Actor) => {
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee || employee.status !== "AVAILABLE_FOR_REDEPLOYMENT") throw new Error("Employee must be available for redeployment.");
  // The follow-up label is a claim: once a TA holds it, only that TA (or an Admin) can change it.
  if (actor?.role === "TALENT_ACQUISITION" && employee.redeploymentOwnerId && employee.redeploymentOwnerId !== actor.id) {
    throw new Error("Only the current follow-up owner or an Admin can change this follow-up.");
  }
  if (data.followUpAt && data.followUpAt < manilaDateString()) throw new Error("Follow-up date must be today or in the future.");
  if (data.ownerId) {
    const owner = await prisma.user.findFirst({ where: { id: data.ownerId, isActive: true, role: { in: ["TALENT_ACQUISITION", "ADMINISTRATOR"] } }, select: { id: true } });
    if (!owner) throw new Error("Choose an active TA or Admin for this follow-up.");
  }
  const updated = await prisma.employee.update({ where: { id }, data: {
    ...(data.ownerId !== undefined ? { redeploymentOwnerId: data.ownerId } : {}),
    ...(data.followUpAt !== undefined ? { redeploymentFollowUpAt: data.followUpAt ? parseManilaDateOnly(data.followUpAt) : null } : {}),
    ...(data.notes !== undefined ? { redeploymentNotes: data.notes } : {}),
  } });
  await logAudit(actorId, "REDEPLOYMENT_FOLLOW_UP_UPDATED", "Employee", id, data);
  return updated;
};

/**
 * Get basic employee details by ID.
 */
export const getEmployeeById = async (id: number, actor?: Actor) => {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          applicantProfile: true,
        },
      },
      deployments: {
        include: {
          client: { select: { id: true, name: true } },
          mrf: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      employmentEvents: {
        orderBy: { effectiveDate: "desc" },
        take: 5,
      },
    },
  });

  if (!employee) throw new Error("Employee not found");

  // Pool view: a TA who does not own this worker sees work history and skills, not identity numbers or private contacts.
  if (actor && !(await owns("employee", id, actor))) {
    const { pagibig, philhealth, sss, tin, dateOfBirth, birthPlace, emergencyContactName, emergencyContactRelationship, emergencyContactPhone, emergencyContactAddress, ...publicProfile } =
      (employee.user?.applicantProfile ?? {}) as any;
    return {
      ...employee,
      user: employee.user ? { ...employee.user, applicantProfile: employee.user.applicantProfile ? publicProfile : null } : employee.user,
      deployments: employee.deployments.map(({ id: deploymentId, client, mrf, actualStart, actualEnd, status, createdAt }: any) => ({ id: deploymentId, client, mrf, actualStart, actualEnd, status, createdAt })),
    } as typeof employee;
  }

  return employee;
};

/**
 * Update employee details and candidate profile.
 */
export const updateEmployeeDetails = async (
  employeeId: number,
  data: any,
  actorId?: string
): Promise<Digital201Aggregate> => {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      user: {
        include: {
          applicantProfile: true,
        },
      },
    },
  });

  if (!employee) {
    throw new Error("Employee not found");
  }

  const currentProfile = employee.user.applicantProfile;
  if (currentProfile) {
    validateStructuredAddress({
      province: data.province !== undefined ? data.province : currentProfile.province,
      city: data.city !== undefined ? data.city : currentProfile.city,
      barangay: data.barangay !== undefined ? data.barangay : currentProfile.barangay,
      postalCode: data.postalCode !== undefined ? data.postalCode : currentProfile.postalCode,
      address: data.address !== undefined ? data.address : currentProfile.address,
    }, currentProfile);
    if (data.dateOfBirth) {
      const nextDob = String(data.dateOfBirth).slice(0, 10);
      const previousDob = currentProfile.dateOfBirth?.toISOString().slice(0, 10);
      if (nextDob !== previousDob && (!isValidDateOnly(nextDob) || nextDob >= manilaDateString())) {
        throw new Error("Date of birth must be a valid date before today.");
      }
    }
  }

  // Update employee-level fields if provided
  const employeeUpdateData: Record<string, any> = {};
  if (data.department !== undefined) {
    employeeUpdateData.department = data.department !== null ? String(data.department).trim() || null : null;
  }
  if (data.position !== undefined) {
    employeeUpdateData.position = data.position !== null ? String(data.position).trim() || null : null;
  }
  if (data.notes !== undefined) {
    employeeUpdateData.notes = data.notes !== null ? String(data.notes).trim() || null : null;
  }

  if (Object.keys(employeeUpdateData).length > 0) {
    await prisma.employee.update({
      where: { id: employeeId },
      data: employeeUpdateData,
    });
  }

  // Update applicant profile fields for employee.userId
  const profileUpdateData: Record<string, any> = {};

  if (data.firstName !== undefined) {
    if (typeof data.firstName === "string" && data.firstName.trim()) {
      profileUpdateData.firstName = data.firstName.trim();
    }
  }
  if (data.lastName !== undefined) {
    if (typeof data.lastName === "string" && data.lastName.trim()) {
      profileUpdateData.lastName = data.lastName.trim();
    }
  }
  if (data.middleName !== undefined) {
    profileUpdateData.middleName = typeof data.middleName === "string" ? data.middleName.trim() || null : null;
  }
  if (data.mobileNumber !== undefined) {
    profileUpdateData.mobileNumber = typeof data.mobileNumber === "string" ? data.mobileNumber.trim() || null : null;
  }
  if (data.address !== undefined) {
    profileUpdateData.address = typeof data.address === "string" ? data.address.trim() || null : null;
  }
  if (data.city !== undefined) {
    profileUpdateData.city = typeof data.city === "string" ? data.city.trim() || null : null;
  }
  if (data.province !== undefined) {
    profileUpdateData.province = typeof data.province === "string" ? data.province.trim() || null : null;
  }
  if (data.barangay !== undefined) {
    profileUpdateData.barangay = typeof data.barangay === "string" ? data.barangay.trim() || null : null;
  }
  if (data.postalCode !== undefined) {
    profileUpdateData.postalCode = typeof data.postalCode === "string" ? data.postalCode.trim() || null : null;
  }
  if (data.civilStatus !== undefined) {
    profileUpdateData.civilStatus = typeof data.civilStatus === "string" ? data.civilStatus.trim() || null : null;
  }
  if (data.gender !== undefined) {
    profileUpdateData.gender = typeof data.gender === "string" ? data.gender.trim() || null : null;
  }
  if (data.dateOfBirth !== undefined) {
    let parsedDate: Date | null = null;
    if (data.dateOfBirth) {
      parsedDate = new Date(data.dateOfBirth);
      if (isNaN(parsedDate.getTime())) {
        throw new Error("Invalid dateOfBirth format");
      }
    }
    profileUpdateData.dateOfBirth = parsedDate;
  }
  if (data.sss !== undefined) {
    profileUpdateData.sss = typeof data.sss === "string" ? data.sss.trim() || null : null;
  }
  if (data.philhealth !== undefined) {
    profileUpdateData.philhealth = typeof data.philhealth === "string" ? data.philhealth.trim() || null : null;
  }
  if (data.pagibig !== undefined) {
    profileUpdateData.pagibig = typeof data.pagibig === "string" ? data.pagibig.trim() || null : null;
  }
  if (data.tin !== undefined) {
    profileUpdateData.tin = typeof data.tin === "string" ? data.tin.trim() || null : null;
  }
  if (data.emergencyContactName !== undefined) {
    profileUpdateData.emergencyContactName = typeof data.emergencyContactName === "string" ? data.emergencyContactName.trim() || null : null;
  }
  if (data.emergencyContactPhone !== undefined) {
    profileUpdateData.emergencyContactPhone = typeof data.emergencyContactPhone === "string" ? data.emergencyContactPhone.trim() || null : null;
  }
  if (data.emergencyContactRelationship !== undefined) {
    profileUpdateData.emergencyContactRelationship = typeof data.emergencyContactRelationship === "string" ? data.emergencyContactRelationship.trim() || null : null;
  }
  if (data.emergencyContactAddress !== undefined) {
    profileUpdateData.emergencyContactAddress = typeof data.emergencyContactAddress === "string" ? data.emergencyContactAddress.trim() || null : null;
  }

  if (Object.keys(profileUpdateData).length > 0) {
    await prisma.applicantProfile.upsert({
      where: { userId: employee.userId },
      update: profileUpdateData,
      create: {
        userId: employee.userId,
        firstName: profileUpdateData.firstName || "",
        lastName: profileUpdateData.lastName || "",
        ...profileUpdateData,
      },
    });
  }

  await logAudit(actorId || null, "EMPLOYEE_DETAILS_UPDATED", "Employee", employeeId, {
    employeeFields: Object.keys(employeeUpdateData),
    profileFields: Object.keys(profileUpdateData),
  });

  return await getDigital201ByEmployeeId(employeeId);
};

/**
 * Update employee status (e.g. ACTIVE -> AVAILABLE_FOR_REDEPLOYMENT, or SEPARATED).
 */
export const updateEmployeeStatus = async (
  employeeId: number,
  status: EmploymentStatus,
  actorId?: string,
  reason?: string
) => {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
  });

  if (!employee) throw new Error("Employee not found");

  if (status !== "ACTIVE") {
    const activeDeployment = await prisma.deployment.findFirst({
      where: { employeeId, status: { notIn: ["ENDED", "CANCELLED"] } },
      select: { id: true },
    });
    if (activeDeployment) {
      throw new Error("End or cancel the employee’s current assignment before changing employment status.");
    }
  }

  const eventType: EmploymentEventType =
    status === "SEPARATED"
      ? "SEPARATED"
      : status === "AVAILABLE_FOR_REDEPLOYMENT"
      ? "STATUS_CHANGE"
      : "STATUS_CHANGE";

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id: employeeId },
      data: { status, ...(status === "AVAILABLE_FOR_REDEPLOYMENT" ? { redeploymentAvailableAt: employee.redeploymentAvailableAt || new Date(), ...(actorId ? { redeploymentOwnerId: actorId } : {}) } : {}) },
    });

    await tx.employmentEvent.create({
      data: {
        employeeId,
        eventType,
        description: reason || `Employee status changed from ${employee.status} to ${status}`,
        effectiveDate: new Date(),
        actorId,
        metadata: { fromStatus: employee.status, toStatus: status, reason },
      },
    });

    return updated;
  });
};

/**
 * Create a new deployment for an employee.
 */
export const createEmployeeDeployment = async (
  createdById: string,
  data: {
    employeeId: number;
    clientId: number;
    mrfId?: number;
    site?: string;
    contractStart?: string | Date;
    contractEnd?: string | Date;
    notes?: string;
    applicationId?: number;
    allowOverheadcount?: boolean;
  }
) => {
  const startDay = data.contractStart ? toManilaDateOnly(data.contractStart) : undefined;
  const endDay = data.contractEnd ? toManilaDateOnly(data.contractEnd) : undefined;
  if (startDay && (!isValidDateOnly(startDay) || startDay < manilaDateString())) {
    throw new Error("A new contract start date must be today or later.");
  }
  if (endDay && (!startDay || endDay < startDay)) {
    throw new Error("Contract end date must be on or after contract start.");
  }
  const parsedStart = startDay ? parseManilaDateOnly(startDay) : null;
  const parsedEnd = endDay ? parseManilaDateOnly(endDay) : null;
  const employee = await prisma.employee.findUnique({
    where: { id: data.employeeId },
  });

  if (!employee) throw new Error("Employee not found");
  if (employee.status === "SEPARATED" || employee.status === "INACTIVE") {
    throw new Error(`Cannot deploy an employee with status ${employee.status}`);
  }

  // Active deployment check: an employee cannot have multiple active deployments
  const existingActive = await prisma.deployment.findFirst({
    where: {
      employeeId: data.employeeId,
      status: { notIn: ["ENDED", "CANCELLED"] },
    },
  });

  if (existingActive) {
    throw new Error("Employee already has an active deployment.");
  }

  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) throw new Error("Client not found");

  if (data.mrfId) {
    const mrf = await prisma.manpowerRequest.findUnique({ where: { id: data.mrfId } });
    if (!mrf) throw new Error("Manpower Request not found");
    if (mrf.status === "CANCELLED") {
      throw new Error("Cannot deploy employee to a cancelled Manpower Request.");
    }
    const fulfillment = await calculateMRFFulfillment(data.mrfId);
    if (fulfillment.isFulfilled && !(data as any).allowOverheadcount) {
      throw new Error(
        `MRF #${data.mrfId} ("${mrf.title}") headcount limit of ${mrf.headcount} pax has already been reached. Expand MRF headcount or archive assignments before deploying more candidates.`
      );
    }
  }

  const deployment = await prisma.$transaction(async (tx) => {
    const deployment = await tx.deployment.create({
      data: {
        employeeId: data.employeeId,
        applicationId: data.applicationId ?? employee.originatingApplicationId ?? null,
        clientId: data.clientId,
        mrfId: data.mrfId || null,
        createdById,
        site: data.site || null,
        contractStart: parsedStart,
        contractEnd: parsedEnd,
        notes: data.notes || null,
        status: "READY_FOR_DEPLOYMENT",
      },
      include: {
        employee: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                applicantProfile: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        client: { select: { id: true, name: true } },
        mrf: { select: { id: true, title: true } },
      },
    }).catch(rethrowPlacementConflict);

    // Record deployment status history
    await tx.deploymentStatusHistory.create({
      data: {
        deploymentId: deployment.id,
        toStatus: "READY_FOR_DEPLOYMENT",
        changedById: createdById,
        reason: data.notes || "Deployment initiated",
      },
    });

    // Record employment event
    await tx.employmentEvent.create({
      data: {
        employeeId: data.employeeId,
        eventType: "DEPLOYED",
        description: `Deployed to ${client.name}${data.site ? ` at ${data.site}` : ""}`,
        effectiveDate: parsedStart ?? new Date(),
        actorId: createdById,
        metadata: {
          deploymentId: deployment.id,
          clientId: client.id,
          clientName: client.name,
          site: data.site,
        },
      },
    });

    // If employee was in redeployment pool, move back to ACTIVE
    if (employee.status === "AVAILABLE_FOR_REDEPLOYMENT") {
      await tx.employee.update({
        where: { id: data.employeeId },
        data: { status: "ACTIVE" },
      });
    }

    return deployment;
  });

  if (data.mrfId) {
    await syncMRFFulfillmentStatus(data.mrfId, createdById);
  }

  return deployment;
};

/**
 * End an employee's deployment and optionally return them to the Redeployment Pool.
 */
export const endEmployeeDeployment = async (
  deploymentId: number,
  actorId: string,
  options?: {
    actualEnd?: string | Date;
    reason?: string;
    disposition?: "AVAILABLE_FOR_REDEPLOYMENT" | "NOT_CONFIRMED" | "SEPARATED";
  }
) => {
  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    include: { client: true, employee: { select: { userId: true, originatingApplicationId: true } } },
  });

  if (!deployment) throw new Error("Deployment not found");
  if (deployment.status === "ENDED" || deployment.status === "CANCELLED") {
    throw new Error(`Deployment is already in ${deployment.status} state`);
  }
  if (deployment.status !== "ACTIVE") {
    throw new Error("Cancel a scheduled placement instead of ending an assignment that has not started.");
  }

  const endDateText = options?.actualEnd ? toManilaDateOnly(options.actualEnd) : manilaDateString();
  if (!isValidDateOnly(endDateText)) throw new Error("A valid actual end date is required");
  if (endDateText > manilaDateString()) throw new Error("Actual end date cannot be in the future");
  const actualEnd = parseManilaDateOnly(endDateText);
  if (deployment.actualStart && actualEnd < deployment.actualStart && !getSecurityControls().earlyAssignmentEndAllowed) {
    throw new Error("Actual end date cannot be before the recorded actual start date");
  }

  const updatedDeployment = await prisma.$transaction(async (tx) => {
    const updated = await tx.deployment.update({
      where: { id: deploymentId },
      data: {
        status: "ENDED",
        actualEnd,
        ...(options?.reason ? { notes: options.reason } : {}),
      },
      include: {
        client: { select: { id: true, name: true } },
        employee: true,
      },
    });

    await tx.deploymentStatusHistory.create({
      data: {
        deploymentId,
        fromStatus: deployment.status,
        toStatus: "ENDED",
        changedById: actorId,
        reason: options?.reason || "Assignment ended",
      },
    });

    await tx.employmentEvent.create({
      data: {
        employeeId: deployment.employeeId,
        eventType: "ASSIGNMENT_ENDED",
        description: `Deployment ended with ${deployment.client.name}: ${options?.reason || "Assignment completed"}`,
        effectiveDate: actualEnd,
        actorId,
        metadata: {
          deploymentId,
          clientId: deployment.clientId,
          reason: options?.reason,
          disposition: options?.disposition,
        },
      },
    });

    if (options?.disposition) {
      const employeeStatus = options.disposition === "AVAILABLE_FOR_REDEPLOYMENT"
        ? "AVAILABLE_FOR_REDEPLOYMENT"
        : options.disposition === "SEPARATED"
          ? "SEPARATED"
          : "INACTIVE";
      await tx.employee.update({
        where: { id: deployment.employeeId },
        data: { status: employeeStatus, ...(employeeStatus === "AVAILABLE_FOR_REDEPLOYMENT" ? { redeploymentAvailableAt: actualEnd, redeploymentOwnerId: actorId } : {}) },
      });

      await tx.employmentEvent.create({
        data: {
          employeeId: deployment.employeeId,
          eventType: employeeStatus === "SEPARATED" ? "SEPARATED" : "STATUS_CHANGE",
          description: employeeStatus === "AVAILABLE_FOR_REDEPLOYMENT"
            ? "Employee marked as available for redeployment"
            : employeeStatus === "SEPARATED"
              ? "Employee separated from the agency"
              : "Redeployment availability has not been confirmed",
          effectiveDate: actualEnd,
          actorId,
          metadata: { deploymentId, disposition: options.disposition },
        },
      });

    }

    return updated;
  });

  if (deployment.mrfId) {
    await syncMRFFulfillmentStatus(deployment.mrfId, actorId);
  }

  return updatedDeployment;
};

/**
 * Get employment events history for an employee.
 */
export const getEmployeeEmploymentHistory = async (employeeId: number) => {
  return await prisma.employmentEvent.findMany({
    where: { employeeId },
    include: {
      actor: {
        select: { id: true, email: true, role: true },
      },
    },
    orderBy: { effectiveDate: "desc" },
  });
};
