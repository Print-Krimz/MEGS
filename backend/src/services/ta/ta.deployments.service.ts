import prisma from "../../utils/prisma.js";
import { DeploymentStatus } from "@prisma/client";
import { isFullyCompliant, generateComplianceRequirementsFromMRF } from "./ta.compliance.service.js";
import { logAudit } from "../../utils/audit.js";
import { sendNotification } from "../../utils/notification.js";
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
  }
) => {
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
      application.status !== "CONTRACT_AND_ORIENTATION" &&
      application.status !== "COMPLIANCE" &&
      application.status !== "ONBOARDING" &&
      application.status !== "HIRED" &&
      application.status !== "DEPLOYED"
    ) {
      throw new Error("Application must be in CONTRACT_AND_ORIENTATION status to deploy.");
    }

    // Compliance check
    const compliant = await isFullyCompliant(data.applicationId);
    if (!compliant) {
      throw new Error("Cannot deploy candidate. All required compliance documents must be APPROVED.");
    }

    // Contract & Orientation check
    if (!application.contractSigned && !application.orientationCompleted) {
      throw new Error("Cannot deploy candidate. Both contract signing and orientation must be completed first.");
    }
    if (!application.contractSigned) {
      throw new Error("Cannot deploy candidate. Employment contract must be signed first.");
    }
    if (!application.orientationCompleted) {
      throw new Error("Cannot deploy candidate. Candidate orientation must be completed first.");
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
    throw new Error("Employee already has an active deployment.");
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

  const startDate = data.contractStart ? new Date(data.contractStart) : null;
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const initialStatus: DeploymentStatus =
    (data as any).status ||
    (startDate && startDate <= todayEnd ? "ACTIVE" : "READY_FOR_DEPLOYMENT");

  const deployment = await prisma.deployment.create({
    data: {
      employeeId: empId,
      applicationId: data.applicationId || employee.originatingApplicationId || null,
      clientId: resolvedClientId,
      mrfId: resolvedMrfId,
      createdById,
      site: resolvedSite,
      contractStart: data.contractStart ? new Date(data.contractStart) : null,
      contractEnd: data.contractEnd ? new Date(data.contractEnd) : null,
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
      mrf: { select: { id: true, title: true } },
    },
  });

  if (resolvedMrfId) {
    await syncMRFFulfillmentStatus(resolvedMrfId, createdById);
  }

  // Record deployment status history
  await prisma.deploymentStatusHistory.create({
    data: {
      deploymentId: deployment.id,
      toStatus: initialStatus,
      changedById: createdById,
      reason: data.notes || (initialStatus === "ACTIVE" ? "Auto-activated on site upon deployment creation" : "Scheduled for site deployment"),
    },
  });

  // Record EmploymentEvent
  await prisma.employmentEvent.create({
    data: {
      employeeId: empId,
      eventType: "DEPLOYED",
      description: `Deployed to ${client.name}${data.site ? ` (${data.site})` : ""}`,
      effectiveDate: data.contractStart ? new Date(data.contractStart) : new Date(),
      actorId: createdById,
      metadata: {
        deploymentId: deployment.id,
        clientId: client.id,
        clientName: client.name,
      },
    },
  });

  if (application && application.status !== "DEPLOYED") {
    await prisma.application.update({
      where: { id: application.id },
      data: { status: "DEPLOYED" },
    });

    await prisma.recruiterDecision.create({
      data: {
        applicationId: application.id,
        actorId: createdById,
        fromStatus: application.status,
        toStatus: "DEPLOYED",
        reason: data.notes || "Candidate deployed to client site",
      },
    });

    // Mark TalentPoolMembership as PLACED
    const appWithProfile = await prisma.application.findUnique({
      where: { id: application.id },
      include: { user: { select: { applicantProfile: { select: { id: true } } } } },
    });
    if (appWithProfile?.user?.applicantProfile) {
      await prisma.talentPoolMembership.updateMany({
        where: { applicantProfileId: appWithProfile.user.applicantProfile.id },
        data: {
          status: "PLACED",
          availability: "UNAVAILABLE",
        },
      });
    }
  }

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
      candidateLink
    );
  }

  const ownerId = application?.jobPosting?.postedById || application?.jobPosting?.mrf?.createdById || (deployment as any).mrf?.createdById;
  if (ownerId && createdById !== ownerId) {
    void sendNotification(
      ownerId,
      "Candidate Deployed",
      `Deployment record for candidate at ${resolvedSite || "Main Site"} is now ${deployment.status}.`,
      "SUCCESS",
      `/ta/deployments/${deployment.id}`
    );
  }

  return deployment;
};

export const updateDeploymentStatus = async (
  id: number,
  status: DeploymentStatus,
  notes?: string,
  actorId?: string
) => {
  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: {
      client: { select: { name: true } },
      employee: { select: { id: true, userId: true, employeeNumber: true, status: true } },
      mrf: { select: { createdById: true } },
      application: {
        select: {
          id: true,
          jobPosting: { select: { postedById: true } },
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

  const updated = await prisma.deployment.update({
    where: { id },
    data: {
      status,
      ...(notes ? { notes } : {}),
    },
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

  if (deployment.mrfId && (status === "CANCELLED" || status === "ENDED")) {
    await syncMRFFulfillmentStatus(deployment.mrfId, actorId);
  }

  // Record DeploymentStatusHistory audit trail
  if (actorId) {
    await prisma.deploymentStatusHistory.create({
      data: {
        deploymentId: id,
        fromStatus: currentStatus,
        toStatus: status,
        changedById: actorId,
        reason: notes || `Status changed to ${status}`,
      },
    }).catch(() => {});
  }

  // Synchronize Employee Status & Career Timeline Event
  if (deployment.employeeId) {
    if (status === "ENDED") {
      await prisma.employee.update({
        where: { id: deployment.employeeId },
        data: { status: "AVAILABLE_FOR_REDEPLOYMENT" },
      });

      await prisma.employmentEvent.create({
        data: {
          employeeId: deployment.employeeId,
          eventType: "ASSIGNMENT_ENDED",
          description: notes || `Assignment with ${deployment.client?.name || "Client"} ended. Candidate is available for redeployment.`,
          effectiveDate: new Date(),
          actorId: actorId || null,
          metadata: {
            deploymentId: id,
            clientName: deployment.client?.name,
          },
        },
      });

      // Update TalentPool availability back to AVAILABLE
      if (deployment.employee?.userId) {
        const profile = await prisma.applicantProfile.findUnique({
          where: { userId: deployment.employee.userId },
        });
        if (profile) {
          await prisma.talentPoolMembership.updateMany({
            where: { applicantProfileId: profile.id },
            data: {
              status: "ACTIVE",
              availability: "AVAILABLE",
            },
          });
        }
      }
    } else if (status === "ACTIVE") {
      await prisma.employee.update({
        where: { id: deployment.employeeId },
        data: { status: "ACTIVE" },
      });
    }
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
      candidateLink
    );
  }

  const ownerId = deployment.mrf?.createdById || deployment.application?.jobPosting?.postedById;
  if (ownerId && actorId && ownerId !== actorId) {
    void sendNotification(
      ownerId,
      "Deployment Status Updated",
      `Deployment record for candidate at ${deployment.site || "Main Site"} is now ${status}.`,
      "SUCCESS",
      `/ta/deployments/${deployment.id}`
    );
  }

  return updated;
};

export const autoPromoteDeployments = async () => {
  try {
    const now = new Date();

    // 1. Promote READY_FOR_DEPLOYMENT -> ACTIVE if contractStart <= now
    const readyDeployments = await prisma.deployment.findMany({
      where: {
        status: "READY_FOR_DEPLOYMENT",
        contractStart: { lte: now },
      },
      select: { id: true, employeeId: true },
    });

    if (readyDeployments.length > 0) {
      const ids = readyDeployments.map((d) => d.id);
      await prisma.deployment.updateMany({
        where: { id: { in: ids } },
        data: { status: "ACTIVE" },
      });

      const empIds = readyDeployments.map((d) => d.employeeId).filter(Boolean) as number[];
      if (empIds.length > 0) {
        await prisma.employee.updateMany({
          where: { id: { in: empIds } },
          data: { status: "ACTIVE" },
        });
      }
    }

    // 2. Conclude ACTIVE -> ENDED if contractEnd <= now
    const expiredDeployments = await prisma.deployment.findMany({
      where: {
        status: "ACTIVE",
        contractEnd: { lte: now, not: null },
      },
      select: { id: true, employeeId: true },
    });

    if (expiredDeployments.length > 0) {
      const ids = expiredDeployments.map((d) => d.id);
      await prisma.deployment.updateMany({
        where: { id: { in: ids } },
        data: { status: "ENDED" },
      });

      const empIds = expiredDeployments.map((d) => d.employeeId).filter(Boolean) as number[];
      if (empIds.length > 0) {
        await prisma.employee.updateMany({
          where: { id: { in: empIds } },
          data: { status: "AVAILABLE_FOR_REDEPLOYMENT" },
        });
      }
    }
  } catch {
    // Non-blocking auto-promotion
  }
};

export const listDeployments = async (clientId?: number, status?: string) => {
  await autoPromoteDeployments();

  const where: any = {};
  if (clientId) where.clientId = clientId;
  if (status) where.status = status as DeploymentStatus;

  return await prisma.deployment.findMany({
    where,
    include: {
      employee: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              applicantProfile: { select: { firstName: true, lastName: true, mobileNumber: true } },
            },
          },
        },
      },
      application: {
        include: {
          jobPosting: { select: { id: true, title: true } },
        },
      },
      client: { select: { id: true, name: true, industry: true } },
      mrf: { select: { id: true, title: true } },
      createdBy: { select: { id: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
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
      mrf: { select: { createdById: true } },
      application: {
        select: {
          id: true,
          jobPosting: { select: { postedById: true } },
        },
      },
      employee: { include: { user: true } },
    },
  });
  if (!deployment) throw new Error("Deployment not found");

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
      candidateLink
    );
  }

  if (party === "WORKER" || party === "CLIENT") {
    const recruiterId = deployment.mrf?.createdById || deployment.application?.jobPosting?.postedById || deployment.createdById;
    if (recruiterId && actorId !== recruiterId) {
      void sendNotification(
        recruiterId,
        "Deployment Contract Signed",
        `Deployment contract for candidate at ${deployment.site || "Main Site"} was signed by ${party === "WORKER" ? "Candidate" : "Client Partner"}.`,
        "SUCCESS",
        `/ta/deployments/${deployment.id}`
      );
    }
  }

  return updated;
};

export const updateDeploymentContract = async (
  id: number,
  data: {
    contractDocumentUrl?: string;
    contractTerms?: string;
    contractStatus?: string;
  },
  actorId: string
) => {
  const deployment = await prisma.deployment.findUnique({ where: { id } });
  if (!deployment) throw new Error("Deployment not found");

  const updated = await prisma.deployment.update({
    where: { id },
    data: {
      ...(data.contractDocumentUrl !== undefined && { contractDocumentUrl: data.contractDocumentUrl }),
      ...(data.contractTerms !== undefined && { contractTerms: data.contractTerms }),
      ...(data.contractStatus !== undefined && { contractStatus: data.contractStatus }),
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

  const isGeneralClearance = (label: string): boolean => {
    const norm = label.toLowerCase();
    return (
      norm.includes("nbi") ||
      norm.includes("philhealth") ||
      norm.includes("sss") ||
      norm.includes("pag-ibig") ||
      norm.includes("pagibig") ||
      norm.includes("tin") ||
      norm.includes("bir") ||
      norm.includes("government") ||
      norm.includes("valid id") ||
      norm.includes("police")
    );
  };

  const priorAppIds = priorApplications.map((a) => a.id);
  const eligiblePriorRequirements: any[] = [];

  if (priorAppIds.length > 0) {
    const priorReqs = await prisma.complianceRequirement.findMany({
      where: {
        applicationId: { in: priorAppIds },
        reviewStatus: "APPROVED",
        documentId: { not: null },
        reviewedAt: { gte: twelveMonthsAgo },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
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
  if (application.complianceRequirements.length === 0) {
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
      { key: "nbi", test: (s: string) => s.includes("nbi") },
      { key: "philhealth", test: (s: string) => s.includes("philhealth") },
      { key: "sss", test: (s: string) => s.includes("sss") },
      { key: "pagibig", test: (s: string) => s.includes("pag-ibig") || s.includes("pagibig") },
      { key: "medical", test: (s: string) => s.includes("medical") || s.includes("fit to work") },
      { key: "id", test: (s: string) => s.includes("valid id") || s.includes("government") },
      { key: "contract", test: (s: string) => s.includes("employment contract") || s.includes("signed contract") },
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
            expiresAt: prev.expiresAt,
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
            expiresAt: prev.expiresAt,
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
      `/app/applications/${applicationId}`
    );
  }

  return {
    success: true,
    application: updatedApp,
    carriedOverDocuments: carriedOver,
  };
};

