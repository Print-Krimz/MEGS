import { isGeneralClearance } from "../../utils/compliance-reuse.js";
import prisma from "../../utils/prisma.js";
import { rethrowPlacementConflict } from "../employee/placement-conflict.js";
import { DeploymentStatus, type Prisma } from "@prisma/client";
import { isFullyCompliant, generateComplianceRequirementsFromMRF } from "./ta.compliance.service.js";
import { logAudit } from "../../utils/audit.js";
import { notifyOwner, sendNotification } from "../../utils/notification.js";
import { isValidDateOnly, manilaDateString, parseManilaDateOnly, toManilaDateOnly } from "../../schemas/field-limits.js";
import { PIPELINE_STAGE_ORDER } from "./pipeline-rules.js";
import { assertOwns, deploymentOwnerTaId, JOB_OWNER_SELECT, ownedWhere, type Actor } from "./ownership.js";
import { isPageRequested, pageEnvelope, resolvePage, type PageRequest } from "../../utils/pagination.js";
import {
  calculateMRFFulfillment,
  syncMRFFulfillmentStatus,
} from "./ta.mrf.service.js";

const ALLOWED_DEPLOYMENT_TRANSITIONS: Record<string, string[]> = {
  READY_FOR_DEPLOYMENT: ["ACTIVE", "CANCELLED"],
  ACTIVE:               ["ENDED"],
  ENDED:                [],
  CANCELLED:            [],
};

/** A concurrent change got there first (HTTP 409). */
export class DeploymentConflictError extends Error {
  readonly status = 409;
}

export const createDeployment = async (
  createdById: string,
  data: {
    applicationId?: number;
    employeeId?: number;
    clientId?: number;
    mrfId?: number;
    site?: string;
    contractStart?: string | Date;
    contractEnd?: string | Date;
    notes?: string;
    status?: DeploymentStatus;
    allowOverheadcount?: boolean;
  },
  actor?: Actor
) => {
  // A TA places people only into requisitions and clients they own.
  if (actor) {
    if (data.mrfId) await assertOwns("mrf", data.mrfId, actor);
    if (data.clientId) await assertOwns("client", data.clientId, actor);
  }
  const startDay = data.contractStart ? toManilaDateOnly(data.contractStart) : undefined;
  const endDay = data.contractEnd ? toManilaDateOnly(data.contractEnd) : undefined;
  if (startDay && (!isValidDateOnly(startDay) || startDay < manilaDateString())) {
    throw new Error("A new contract start date must be today or later.");
  }
  if (endDay && (!startDay || endDay < startDay)) {
    throw new Error("Contract end date must be on or after contract start.");
  }
  const parsedContractStart = startDay ? parseManilaDateOnly(startDay) : null;
  const parsedContractEnd = endDay ? parseManilaDateOnly(endDay) : null;

  let empId = data.employeeId;
  let application: any = null;

  if (data.applicationId) {
    application = await prisma.application.findUnique({
      where: { id: data.applicationId },
      include: {
        hiredEmployee: true,
        user: true,
        jobPosting: {
          include: {
            mrf: true,
          },
        },
        clientEndorsements: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!application) throw new Error("Application not found");
    if (
      application.status !== "CONTRACT_SIGNING" &&
      application.status !== "COMPLIANCE" &&
      application.status !== "ONBOARDING" &&
      application.status !== "HIRED" &&
      application.status !== "DEPLOYED"
    ) {
      throw new Error("Application must be in CONTRACT_SIGNING status to deploy.");
    }

    // Compliance check
    const compliant = await isFullyCompliant(data.applicationId);
    if (!compliant) {
      throw new Error("Cannot deploy candidate. All required compliance documents must be APPROVED.");
    }

    // Signed contract check
    if (!application.contractSigned) {
      throw new Error("Cannot deploy candidate. Confirm the contract signing first.");
    }

    if (!empId) {
      if (application.hiredEmployee) {
        empId = application.hiredEmployee.id;
      } else {
        // Find existing employee by user
        let emp = await prisma.employee.findUnique({
          where: { userId: application.userId },
        });
        if (!emp) {
          emp = await prisma.employee.create({
            data: {
              userId: application.userId,
              employeeNumber: `EMP-${new Date().getFullYear()}-${String(application.id).padStart(4, "0")}`,
              originatingApplicationId: application.id,
              status: "ACTIVE",
            },
          });
        }
        empId = emp.id;
      }
    }
  }

  if (!empId) {
    throw new Error("Employee ID or Application ID is required to create a deployment.");
  }

  const employee = await prisma.employee.findUnique({ where: { id: empId } });
  if (!employee) throw new Error("Employee not found");

  // Active deployment check
  const existingActive = await prisma.deployment.findFirst({
    where: {
      employeeId: empId,
      status: { notIn: ["ENDED", "CANCELLED"] },
    },
  });

  if (existingActive) {
    throw new Error(
      `Employee already has an active deployment (#${existingActive.id}, ${existingActive.status}). Confirm its start or end it before creating another.`
    );
  }

  const resolvedClientId =
    data.clientId ||
    application?.jobPosting?.mrf?.clientId ||
    application?.clientEndorsements?.[0]?.clientId;
  if (!resolvedClientId) {
    throw new Error("Client ID is required for deployment. Please select a client.");
  }

  const client = await prisma.client.findUnique({ where: { id: resolvedClientId } });
  if (!client) throw new Error("Client not found");

  const resolvedMrfId = data.mrfId || application?.jobPosting?.mrfId || null;
  if (resolvedMrfId) {
    const mrf = await prisma.manpowerRequest.findUnique({ where: { id: resolvedMrfId } });
    if (!mrf) throw new Error("Manpower Request not found");
    if (mrf.status === "CANCELLED") {
      throw new Error("Cannot deploy candidate to a cancelled Manpower Request.");
    }
    const fulfillment = await calculateMRFFulfillment(resolvedMrfId);
    if (fulfillment.isFulfilled && !(data as any).allowOverheadcount) {
      throw new Error(
        `MRF #${resolvedMrfId} ("${mrf.title}") headcount limit of ${mrf.headcount} pax has already been reached. Expand MRF headcount or archive assignments before deploying more candidates.`
      );
    }
  }

  const resolvedSite =
    data.site ||
    application?.jobPosting?.mrf?.location ||
    application?.jobPosting?.location ||
    null;

  const startDate = parsedContractStart;

  // Scheduled dates prompt TA to confirm attendance; they do not activate
  // or end an assignment by themselves.
  const initialStatus: DeploymentStatus = "READY_FOR_DEPLOYMENT";

  const deployment = await prisma.deployment.create({
    data: {
      employeeId: empId,
      applicationId: data.applicationId || employee.originatingApplicationId || null,
      clientId: resolvedClientId,
      mrfId: resolvedMrfId,
      createdById,
      site: resolvedSite,
      contractStart: parsedContractStart,
      contractEnd: parsedContractEnd,
      notes: data.notes || null,
      status: initialStatus,
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
      mrf: { select: { id: true, title: true, assignedTaId: true } },
    },
  }).catch(rethrowPlacementConflict);

  if (resolvedMrfId) {
    await syncMRFFulfillmentStatus(resolvedMrfId, createdById);
  }

  // Record deployment status history
  await prisma.deploymentStatusHistory.create({
    data: {
      deploymentId: deployment.id,
      toStatus: initialStatus,
      changedById: createdById,
      reason: "Scheduled for site deployment; TA must confirm attendance to activate.",
    },
  });

  void logAudit(createdById, "DEPLOYMENT_CREATED", "Deployment", deployment.id, {
    deploymentId: deployment.id,
    clientId: resolvedClientId,
    clientName: client.name,
    site: resolvedSite,
    employeeId: empId,
  });

  const candidateUserId = deployment.employee?.user?.id || application?.userId;
  const candidateLink = application?.id || deployment.applicationId
    ? `/app/applications/${application?.id || deployment.applicationId}`
    : `/app/profile`;

  if (candidateUserId) {
    void sendNotification(
      candidateUserId,
      "Deployment Scheduled",
      `Your deployment record has been created for site: ${resolvedSite || "Main Site"}.`,
      "SUCCESS",
      candidateLink,
      {
        dedupeKey: `deployment-scheduled:${deployment.id}:${candidateUserId}`,
        sms: {
          always: true,
          text: `Your deployment is scheduled at ${resolvedSite || "Main Site"}. Log in to MEGS for details.`,
        },
      }
    );
  }

  void notifyOwner(
    deploymentOwnerTaId({ ...deployment, application }),
    "Candidate Deployed",
    `Deployment record for candidate at ${resolvedSite || "Main Site"} is now ${deployment.status}.`,
    "SUCCESS",
    `/ta/deployments/${deployment.id}`,
    { excludeUserId: createdById }
  );

  return deployment;
};

export const updateDeploymentStatus = async (
  id: number,
  status: DeploymentStatus,
  notes?: string,
  actorId?: string,
  actualStart?: string | Date
) => {
  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: {
      client: { select: { name: true } },
      employee: { select: { id: true, userId: true, employeeNumber: true, status: true } },
      mrf: { select: { assignedTaId: true } },
      application: {
        select: {
          id: true,
          status: true,
          jobPosting: { select: JOB_OWNER_SELECT },
        },
      },
    },
  });
  if (!deployment) throw new Error("Deployment not found");

  const currentStatus = deployment.status;
  const allowed = ALLOWED_DEPLOYMENT_TRANSITIONS[currentStatus] ?? [];

  if (!allowed.includes(status)) {
    throw new Error(`Cannot transition deployment from ${currentStatus} to ${status}. Allowed: ${allowed.length ? allowed.join(", ") : "none"}`);
  }

  if (status === "ENDED") {
    throw new Error("Use the End assignment action to record the actual end date and employee status.");
  }

  const startDate = status === "ACTIVE"
    // Stored as a Manila calendar date (like actualEnd) so same-day start/end compare correctly.
    ? parseManilaDateOnly(actualStart ? toManilaDateOnly(actualStart) : manilaDateString())
    : undefined;
  if (startDate && toManilaDateOnly(startDate) < manilaDateString()) {
    throw new Error("Actual start date cannot be in the past. Please select today or a future date.");
  }

  // The worker never started, so the application goes back to contract signing instead of staying DEPLOYED.
  const revertApplicationId =
    status === "CANCELLED" && deployment.applicationId && deployment.application?.status === "DEPLOYED"
      ? deployment.applicationId
      : null;

  // One transaction: every write for this transition lands together or not at all. A cancelled
  // deployment can never be retried, and a half-confirmed start would leave the worker inconsistent.
  const updated = await prisma.$transaction(async (tx) => {
    // Guarded on the status we validated, so a concurrent confirm/cancel cannot apply a second transition.
    const claimed = await tx.deployment.updateMany({
      where: { id, status: currentStatus },
      data: {
        status,
        ...(startDate ? { actualStart: startDate } : {}),
        ...(notes ? { notes } : {}),
      },
    });
    if (claimed.count === 0) {
      throw new DeploymentConflictError("This deployment was already updated by someone else. Refresh and try again.");
    }

    const row = await tx.deployment.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            userId: true,
            employeeNumber: true,
            status: true,
          },
        },
        client: { select: { id: true, name: true } },
      },
    });

    if (revertApplicationId) {
      await tx.application.update({ where: { id: revertApplicationId }, data: { status: "CONTRACT_SIGNING" } });
      // The cancelled placement no longer counts as an entry into Deployed in the reports.
      await tx.recruiterDecision.updateMany({
        where: { applicationId: revertApplicationId, toStatus: "DEPLOYED", isReverted: false },
        data: { isReverted: true },
      });
      if (actorId) {
        await tx.recruiterDecision.create({
          data: {
            applicationId: revertApplicationId,
            actorId,
            fromStatus: "DEPLOYED",
            toStatus: "CONTRACT_SIGNING",
            reason: notes || "Deployment cancelled before the worker started.",
          },
        });
      }
    }

    if (status === "ACTIVE" && deployment.applicationId && deployment.application?.status !== "DEPLOYED") {
      await tx.application.update({ where: { id: deployment.applicationId }, data: { status: "DEPLOYED" } });
      if (actorId) {
        await tx.recruiterDecision.create({
          data: {
            applicationId: deployment.applicationId,
            actorId,
            fromStatus: deployment.application?.status || "CONTRACT_SIGNING",
            toStatus: "DEPLOYED",
            reason: notes || "TA confirmed the worker started at the client site.",
          },
        });
      }
    }

    // Record DeploymentStatusHistory audit trail
    if (actorId) {
      await tx.deploymentStatusHistory.create({
        data: {
          deploymentId: id,
          fromStatus: currentStatus,
          toStatus: status,
          changedById: actorId,
          reason: notes || `Status changed to ${status}`,
        },
      });
    }

    // Synchronize Employee Status & Career Timeline Event
    if (status === "ACTIVE" && deployment.employeeId) {
      await tx.employee.update({
        where: { id: deployment.employeeId },
        data: { status: "ACTIVE" },
      });
      await tx.employmentEvent.create({
        data: {
          employeeId: deployment.employeeId,
          eventType: "DEPLOYED",
          description: `Deployment start confirmed with ${deployment.client.name}`,
          effectiveDate: startDate || new Date(),
          actorId: actorId || null,
          metadata: { deploymentId: id, clientName: deployment.client.name, actualStart: startDate },
        },
      });
      if (deployment.employee.userId) {
        const profile = await tx.applicantProfile.findUnique({ where: { userId: deployment.employee.userId }, select: { id: true } });
        if (profile) {
          await tx.talentPoolMembership.updateMany({
            where: { applicantProfileId: profile.id },
            data: { status: "PLACED", availability: "UNAVAILABLE" },
          });
        }
      }
    }
    return row;
  }).catch(rethrowPlacementConflict);

  // Recomputed from the deployments, so it can safely run after the commit.
  if (deployment.mrfId && status === "CANCELLED") {
    await syncMRFFulfillmentStatus(deployment.mrfId, actorId);
  }

  void logAudit(actorId || null, "DEPLOYMENT_STATUS_UPDATED", "Deployment", id, {
    deploymentId: id,
    previousStatus: currentStatus,
    status,
    clientName: deployment.client?.name,
    notes,
  });

  const candidateLink = deployment.applicationId || deployment.application?.id
    ? `/app/applications/${deployment.applicationId || deployment.application?.id}`
    : `/app/profile`;

  if (deployment.employee?.userId) {
    void sendNotification(
      deployment.employee.userId,
      "Deployment Update",
      `Your deployment status has been updated to ${status.replace(/_/g, " ")}.`,
      "INFO",
      candidateLink,
      { sms: { text: `Your deployment status is now ${status.replace(/_/g, " ")}. Log in to MEGS for details.` } }
    );
  }

  void notifyOwner(
    deploymentOwnerTaId(deployment),
    "Deployment Status Updated",
    `Deployment record for candidate at ${deployment.site || "Main Site"} is now ${status}.`,
    "SUCCESS",
    `/ta/deployments/${deployment.id}`,
    { excludeUserId: actorId }
  );

  return updated;
};

export const autoPromoteDeployments = async () => {
  // Kept for existing list callers. Scheduled dates alone no longer change
  // deployment or employment status.
};

export interface DeploymentListOptions extends PageRequest {
  search?: string;
}

// Only the columns the Deployments list, client page and dashboard read. Notes, contract terms and the
// worker/application heavy columns stay out; the detail endpoint still returns them.
const DEPLOYMENT_LIST_SELECT = {
  id: true, employeeId: true, applicationId: true, clientId: true, mrfId: true, status: true, site: true,
  contractStart: true, contractEnd: true, actualStart: true, actualEnd: true,
  contractStatus: true, workerSigned: true, workerSignedAt: true, clientSigned: true, clientSignedAt: true,
  createdById: true, createdAt: true, updatedAt: true,
  employee: {
    select: {
      id: true, userId: true, employeeNumber: true, status: true, hireDate: true, department: true, position: true,
      user: {
        select: {
          id: true,
          email: true,
          applicantProfile: { select: { firstName: true, lastName: true, mobileNumber: true } },
        },
      },
    },
  },
  application: { select: { id: true, jobPosting: { select: { id: true, title: true } } } },
  client: { select: { id: true, name: true, industry: true } },
  mrf: { select: { id: true, title: true } },
  createdBy: { select: { id: true, email: true } },
} satisfies Prisma.DeploymentSelect;

// Same fields the Deployments screen has always searched: worker name, email, number, site, client, and role.
const deploymentSearchClause = (search: string): Prisma.DeploymentWhereInput => {
  const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });
  const profileMatches = (value: string): Prisma.ApplicantProfileWhereInput => ({ OR: [{ firstName: contains(value) }, { lastName: contains(value) }] });
  const tokens = search.split(/\s+/).filter(Boolean);
  return {
    OR: [
      { employee: { is: { user: { is: { applicantProfile: { is: profileMatches(search) } } } } } },
      { application: { is: { user: { is: { applicantProfile: { is: profileMatches(search) } } } } } },
      ...(tokens.length > 1
        ? [
            { employee: { is: { user: { is: { AND: tokens.map((token) => ({ applicantProfile: { is: profileMatches(token) } })) } } } } },
            { application: { is: { user: { is: { AND: tokens.map((token) => ({ applicantProfile: { is: profileMatches(token) } })) } } } } },
          ]
        : []),
      { employee: { is: { user: { is: { email: contains(search) } } } } },
      { application: { is: { user: { is: { email: contains(search) } } } } },
      { employee: { is: { employeeNumber: contains(search) } } },
      { site: contains(search) },
      { client: { is: { name: contains(search) } } },
      { application: { is: { jobPosting: { is: { title: contains(search) } } } } },
      { mrf: { is: { title: contains(search) } } },
    ],
  };
};

export const listDeployments = async (clientId?: number, status?: string, actor?: Actor, options: DeploymentListOptions = {}) => {
  await autoPromoteDeployments();

  const where: Prisma.DeploymentWhereInput = actor ? { ...ownedWhere.deployment(actor) } : {};
  if (clientId) where.clientId = clientId;
  if (status === "ENDED_REDEPLOYMENT" || status === "ENDED_SEPARATED") {
    where.status = "ENDED";
    where.employee = { is: { status: status === "ENDED_REDEPLOYMENT" ? "AVAILABLE_FOR_REDEPLOYMENT" : "SEPARATED" } };
  } else if (status) {
    where.status = status as DeploymentStatus;
  }
  const search = options.search?.trim();
  if (search) where.AND = [deploymentSearchClause(search)];

  const orderBy: Prisma.DeploymentOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "desc" }];

  if (isPageRequested(options)) {
    const { page, pageSize, skip, take } = resolvePage(options);
    const [items, total] = await Promise.all([
      prisma.deployment.findMany({ where, select: DEPLOYMENT_LIST_SELECT, orderBy, skip, take }),
      prisma.deployment.count({ where }),
    ]);
    return pageEnvelope(items, total, page, pageSize);
  }

  return await prisma.deployment.findMany({ where, select: DEPLOYMENT_LIST_SELECT, orderBy });
};

export const getDeploymentDetails = async (id: number) => {
  await autoPromoteDeployments();

  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: {
      employee: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              applicantProfile: true,
            },
          },
        },
      },
      application: {
        include: {
          jobPosting: true,
          complianceRequirements: true,
          postHireDocuments: true,
        },
      },
      client: true,
      mrf: true,
      createdBy: { select: { id: true, email: true } },
      statusHistory: { orderBy: { createdAt: "asc" } },
      agreementVersions: { orderBy: { recordedAt: "desc" } },
    },
  });

  if (!deployment) throw new Error("Deployment not found");
  return deployment;
};

export const signDeploymentContract = async (
  id: number,
  party: "WORKER" | "CLIENT",
  actorId: string,
  notes?: string
) => {
  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: {
      client: true,
      mrf: { select: { assignedTaId: true } },
      application: {
        select: {
          id: true,
          jobPosting: { select: JOB_OWNER_SELECT },
        },
      },
      employee: { include: { user: true } },
    },
  });
  if (!deployment) throw new Error("Deployment not found");
  if (deployment.status === "CANCELLED" || deployment.status === "ENDED") {
    throw new Error("This deployment is closed, so the contract can't be signed.");
  }
  if (deployment.workerSigned && deployment.clientSigned) {
    throw new Error("This contract has already been fully signed.");
  }
  if ((party === "WORKER" && deployment.workerSigned) || (party === "CLIENT" && deployment.clientSigned)) {
    throw new Error("This party has already signed this contract.");
  }

  const now = new Date();
  const isWorker = party === "WORKER";
  const isClient = party === "CLIENT";

  const workerSigned = isWorker ? true : deployment.workerSigned;
  const workerSignedAt = isWorker ? now : deployment.workerSignedAt;
  const clientSigned = isClient ? true : deployment.clientSigned;
  const clientSignedAt = isClient ? now : deployment.clientSignedAt;

  const fullySigned = Boolean(workerSigned && clientSigned);
  const contractStatus = fullySigned
    ? "FULLY_EXECUTED"
    : workerSigned
    ? "WORKER_SIGNED"
    : clientSigned
    ? "CLIENT_SIGNED"
    : "PENDING_SIGNATURES";

  const updated = await prisma.deployment.update({
    where: { id },
    data: {
      workerSigned,
      workerSignedAt,
      clientSigned,
      clientSignedAt,
      contractStatus,
      ...(notes ? { notes } : {}),
    },
    include: {
      employee: {
        include: {
          user: { select: { id: true, email: true, applicantProfile: true } },
        },
      },
      client: true,
      mrf: true,
    },
  });

  void logAudit(actorId, "DEPLOYMENT_CONTRACT_SIGNED", "Deployment", id, {
    deploymentId: id,
    party,
    contractStatus,
    workerSigned,
    clientSigned,
    notes,
  });

  const candidateLink = deployment.applicationId || deployment.application?.id
    ? `/app/applications/${deployment.applicationId || deployment.application?.id}`
    : `/app/profile`;

  if (deployment.employee?.userId) {
    void sendNotification(
      deployment.employee.userId,
      "Contract Signed",
      `Deployment contract has been signed by ${party === "WORKER" ? "Candidate" : "Client Partner"}. Status: ${contractStatus}`,
      "SUCCESS",
      candidateLink,
      { sms: { text: "Your deployment contract has been signed. Log in to MEGS for details." } }
    );
  }

  if (party === "WORKER" || party === "CLIENT") {
    void notifyOwner(
      deploymentOwnerTaId(deployment),
      "Deployment Contract Signed",
      `Deployment contract for candidate at ${deployment.site || "Main Site"} was signed by ${party === "WORKER" ? "Candidate" : "Client Partner"}.`,
      "SUCCESS",
      `/ta/deployments/${deployment.id}`,
      { excludeUserId: actorId }
    );
  }

  return updated;
};

export const updateDeploymentContract = async (
  id: number,
  data: {
    contractDocumentUrl?: string;
    contractTerms?: string;
    contractStatus?: string;
    contractEnd?: string | Date | null;
  },
  actorId: string
) => {
  const deployment = await prisma.deployment.findUnique({ where: { id } });
  if (!deployment) throw new Error("Deployment not found");

  if (data.contractEnd !== undefined && data.contractEnd !== null && deployment.contractStart && toManilaDateOnly(data.contractEnd) < toManilaDateOnly(deployment.contractStart)) {
    throw new Error("Agreement end date cannot be before the agreement start date.");
  }

  const requestedContractEnd = data.contractEnd === undefined
    ? deployment.contractEnd
    : data.contractEnd
      ? parseManilaDateOnly(toManilaDateOnly(data.contractEnd))
      : null;
  const changed =
    (data.contractDocumentUrl !== undefined && data.contractDocumentUrl !== deployment.contractDocumentUrl) ||
    (data.contractTerms !== undefined && data.contractTerms !== deployment.contractTerms) ||
    (data.contractStatus !== undefined && data.contractStatus !== deployment.contractStatus) ||
    (data.contractEnd !== undefined && toManilaDateOnly(requestedContractEnd || new Date(0)) !== toManilaDateOnly(deployment.contractEnd || new Date(0)));
  if (changed) {
    await prisma.deploymentAgreementVersion.create({
      data: {
        deploymentId: id,
        recordedById: actorId,
        contractStart: deployment.contractStart,
        contractEnd: deployment.contractEnd,
        contractDocumentUrl: deployment.contractDocumentUrl,
        contractStatus: deployment.contractStatus,
        workerSigned: deployment.workerSigned,
        workerSignedAt: deployment.workerSignedAt,
        clientSigned: deployment.clientSigned,
        clientSignedAt: deployment.clientSignedAt,
        contractTerms: deployment.contractTerms,
      },
    });
  }

  const updated = await prisma.deployment.update({
    where: { id },
    data: {
      ...(data.contractDocumentUrl !== undefined && { contractDocumentUrl: data.contractDocumentUrl }),
      ...(data.contractTerms !== undefined && { contractTerms: data.contractTerms }),
      ...(data.contractStatus !== undefined && { contractStatus: data.contractStatus }),
      ...(data.contractEnd !== undefined && { contractEnd: requestedContractEnd }),
    },
  });

  void logAudit(actorId, "DEPLOYMENT_CONTRACT_UPDATED", "Deployment", id, {
    deploymentId: id,
    ...data,
  });

  return updated;
};

export const fastTrackRedeployment = async (
  applicationId: number,
  actorId: string,
  options?: { targetStage?: "FINAL_INTERVIEW" | "COMPLIANCE" }
) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      user: {
        include: {
          employee: {
            include: {
              deployments: true,
            },
          },
          applicantProfile: true,
        },
      },
      jobPosting: {
        include: {
          mrf: {
            include: {
              client: true,
            },
          },
        },
      },
      complianceRequirements: true,
      hiredEmployee: true,
    },
  });

  if (!application) {
    throw new Error("Application not found");
  }

  const ALLOWED_EARLY_STAGES = [
    "SUBMITTED",
    "PARSING",
    "REVIEW",
    "MATCHED",
    "NEEDS_ATTENTION",
    "INITIAL_SCREENING",
  ];

  if (application.isArchived || !ALLOWED_EARLY_STAGES.includes(application.status)) {
    throw new Error(
      `Cannot fast-track application currently in ${application.status} stage.`
    );
  }

  // Check candidate eligibility: verify user has an associated Employee record
  // with previous deployments, or status AVAILABLE_FOR_REDEPLOYMENT.
  const employee =
    application.user?.employee ||
    (await prisma.employee.findUnique({
      where: { userId: application.userId },
      include: { deployments: true },
    }));

  if (!employee) {
    throw new Error(
      "Candidate is not eligible for redeployment fast-track. Prior employment or deployment history is required."
    );
  }

  const hasDeployments = employee.deployments && employee.deployments.length > 0;
  const isAvailableForRedeployment = employee.status === "AVAILABLE_FOR_REDEPLOYMENT";

  if (!hasDeployments && !isAvailableForRedeployment) {
    throw new Error(
      "Candidate is not eligible for redeployment fast-track. Prior deployment history or AVAILABLE_FOR_REDEPLOYMENT status is required."
    );
  }

  const targetStage =
    options?.targetStage === "FINAL_INTERVIEW" ? "FINAL_INTERVIEW" : "COMPLIANCE";

  const targetClientId =
    application.jobPosting?.mrf?.clientId ||
    application.jobPosting?.mrf?.client?.id ||
    null;

  // Find prior applications for the same candidate
  const priorApplications = await prisma.application.findMany({
    where: {
      userId: application.userId,
      id: { not: applicationId },
    },
    include: {
      jobPosting: {
        include: {
          mrf: {
            select: { clientId: true },
          },
        },
      },
      clientEndorsements: {
        select: { clientId: true },
      },
      deployments: {
        select: { clientId: true },
      },
    },
  });

  const now = new Date();
  const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const priorAppClientMap = new Map<number, Set<number>>();
  for (const priorApp of priorApplications) {
    const clientIds = new Set<number>();
    if (priorApp.jobPosting?.mrf?.clientId) {
      clientIds.add(priorApp.jobPosting.mrf.clientId);
    }
    if (priorApp.clientEndorsements) {
      for (const end of priorApp.clientEndorsements) {
        if (end.clientId) clientIds.add(end.clientId);
      }
    }
    if (priorApp.deployments) {
      for (const dep of priorApp.deployments) {
        if (dep.clientId) clientIds.add(dep.clientId);
      }
    }
    priorAppClientMap.set(priorApp.id, clientIds);
  }

  const priorAppIds = priorApplications.map((a) => a.id);
  const eligiblePriorRequirements: any[] = [];

  if (priorAppIds.length > 0) {
    const priorReqs = await prisma.complianceRequirement.findMany({
      where: {
        applicationId: { in: priorAppIds },
        reviewStatus: "APPROVED",
        documentId: { not: null },
        reviewedAt: { gte: twelveMonthsAgo },
        // Same validity rule as same-client reuse and isFullyCompliant: only verified, unexpired documents.
        OR: [
          { validityStatus: "NO_EXPIRY" },
          { validityStatus: "HAS_EXPIRY", expiresAt: { gt: now } },
        ],
      },
      orderBy: { reviewedAt: "desc" },
    });

    for (const req of priorReqs) {
      const isGeneral = isGeneralClearance(req.documentLabel);
      const appClientIds = priorAppClientMap.get(req.applicationId);
      const isSameClient = Boolean(
        targetClientId && appClientIds && appClientIds.has(targetClientId)
      );

      if (isGeneral || isSameClient) {
        eligiblePriorRequirements.push(req);
      }
    }
  }

  // Deduplicate by normalized documentLabel (keeping most recently reviewed)
  const uniqueEligibleByLabel = new Map<string, (typeof eligiblePriorRequirements)[0]>();
  for (const req of eligiblePriorRequirements) {
    const normLabel = req.documentLabel.trim().toLowerCase();
    if (!uniqueEligibleByLabel.has(normLabel)) {
      uniqueEligibleByLabel.set(normLabel, req);
    }
  }
  const distinctEligible = Array.from(uniqueEligibleByLabel.values());

  // Ensure current application has baseline compliance requirements from MRF/template
  if (targetStage === "COMPLIANCE" && application.complianceRequirements.length === 0) {
    await generateComplianceRequirementsFromMRF(applicationId);
  }

  const findMatchingRequirement = (
    currentList: { id: number; documentLabel: string }[],
    prevLabel: string
  ) => {
    const normPrev = prevLabel.trim().toLowerCase();
    const exact = currentList.find(
      (c) => c.documentLabel.trim().toLowerCase() === normPrev
    );
    if (exact) return exact;

    const keywords = [
      { key: "nbi", test: (s: string) => s.includes("nbi") || s.includes("police") },
      { key: "philhealth", test: (s: string) => s.includes("philhealth") },
      { key: "sss", test: (s: string) => s.includes("sss") },
      { key: "pagibig", test: (s: string) => s.includes("pag-ibig") || s.includes("pagibig") },
      { key: "medical", test: (s: string) => s.includes("medical") || s.includes("fit to work") },
      { key: "id", test: (s: string) => s.includes("valid id") || s.includes("government") },
      { key: "nda", test: (s: string) => s.includes("nda") || s.includes("security briefing") },
    ];

    for (const kw of keywords) {
      if (kw.test(normPrev)) {
        const match = currentList.find((c) => kw.test(c.documentLabel.toLowerCase()));
        if (match) return match;
      }
    }

    return null;
  };

  // Wrap atomic writes in an interactive database transaction
  const { updatedApp, carriedOver } = await prisma.$transaction(async (tx) => {
    const currentRequirements = await tx.complianceRequirement.findMany({
      where: { applicationId },
    });

    const carriedOverDocs: any[] = [];
    const updatedRequirementIds = new Set<number>();

    for (const prev of distinctEligible) {
      const matching = findMatchingRequirement(
        currentRequirements.filter((c) => !updatedRequirementIds.has(c.id)),
        prev.documentLabel
      );

      if (matching) {
        const updated = await tx.complianceRequirement.update({
          where: { id: matching.id },
          data: {
            reviewStatus: "APPROVED",
            documentId: prev.documentId,
            issuedAt: prev.issuedAt,
            expiresAt: prev.expiresAt,
            validityStatus: prev.validityStatus,
            reviewedById: actorId,
            reviewedAt: new Date(),
            reviewNotes: "Carried over from prior approved deployment (Redeployment Fast-Track)",
          },
        });
        updatedRequirementIds.add(matching.id);
        carriedOverDocs.push(updated);
      } else {
        const created = await tx.complianceRequirement.create({
          data: {
            applicationId,
            documentLabel: prev.documentLabel,
            isRequired: prev.isRequired,
            reviewStatus: "APPROVED",
            documentId: prev.documentId,
            issuedAt: prev.issuedAt,
            expiresAt: prev.expiresAt,
            validityStatus: prev.validityStatus,
            reviewedById: actorId,
            reviewedAt: new Date(),
            reviewNotes: "Carried over from prior approved deployment (Redeployment Fast-Track)",
          },
        });
        carriedOverDocs.push(created);
      }
    }

    // If advancing to COMPLIANCE, ensure employee record is linked
    if (targetStage === "COMPLIANCE") {
      if (!employee.originatingApplicationId) {
        await tx.employee.update({
          where: { id: employee.id },
          data: { originatingApplicationId: applicationId },
        });
      }
    }

    // Record EmploymentEvent
    await tx.employmentEvent.create({
      data: {
        employeeId: employee.id,
        eventType: "REDEPLOYED",
        description: `Fast-tracked redeployment for Application #${applicationId} to ${targetStage}`,
        effectiveDate: new Date(),
        actorId,
        metadata: {
          applicationId,
          targetStage,
          carriedOverCount: carriedOverDocs.length,
        },
      },
    });

    // Advance application status to targetStage
    const updated = await tx.application.update({
      where: { id: applicationId },
      data: {
        status: targetStage,
      },
      include: {
        jobPosting: {
          include: {
            mrf: {
              include: { client: true },
            },
          },
        },
        user: {
          include: {
            applicantProfile: true,
            employee: true,
          },
        },
        complianceRequirements: true,
      },
    });

    // Record recruiter decision
    await tx.recruiterDecision.create({
      data: {
        applicationId,
        actorId,
        fromStatus: application.status,
        toStatus: targetStage,
        reason: `Redeployment fast-track: advanced to ${targetStage} with ${carriedOverDocs.length} carried-over clearance documents.`,
        transitionType: "FAST_TRACK",
        skippedStages: PIPELINE_STAGE_ORDER.slice(0, PIPELINE_STAGE_ORDER.indexOf(targetStage as any)).filter(
          (stage) => stage !== application.status
        ),
      },
    });

    return { updatedApp: updated, carriedOver: carriedOverDocs };
  }, { maxWait: 10000, timeout: 20000 });

  // Log audit trail
  void logAudit(actorId, "REDEPLOYMENT_FAST_TRACKED", "Application", applicationId, {
    carriedDocumentsCount: carriedOver.length,
    targetStage,
  });

  // Candidate notification
  if (application.userId) {
    void sendNotification(
      application.userId,
      "Redeployment Fast-Tracked",
      `Your application for ${application.jobPosting?.title || "the role"} has been fast-tracked to ${targetStage}. ${carriedOver.length} valid clearances have been carried over.`,
      "SUCCESS",
      `/app/applications/${applicationId}`,
      { sms: { text: `Your application for ${application.jobPosting?.title || "the role"} was fast-tracked. Log in to MEGS for details.` } }
    );
  }

  return {
    success: true,
    application: updatedApp,
    carriedOverDocuments: carriedOver,
  };
};

