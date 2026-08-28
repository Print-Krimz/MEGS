import prisma from "../../utils/prisma.js";
import { DeploymentStatus } from "@prisma/client";
import { isFullyCompliant } from "./ta.compliance.service.js";
import { logAudit } from "../../utils/audit.js";
import { sendNotification } from "../../utils/notification.js";

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
      application.status !== "COMPLIANCE" &&
      application.status !== "ONBOARDING" &&
      application.status !== "HIRED" &&
      application.status !== "DEPLOYED"
    ) {
      throw new Error("Application must be in COMPLIANCE, ONBOARDING or HIRED status to deploy.");
    }

    // Compliance check
    const compliant = await isFullyCompliant(data.applicationId);
    if (!compliant) {
      throw new Error("Cannot deploy candidate. All required compliance documents must be APPROVED.");
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
  }

  const resolvedSite =
    data.site ||
    application?.jobPosting?.mrf?.location ||
    application?.jobPosting?.location ||
    null;

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
  });

  // Record deployment status history
  await prisma.deploymentStatusHistory.create({
    data: {
      deploymentId: deployment.id,
      toStatus: "READY_FOR_DEPLOYMENT",
      changedById: createdById,
      reason: data.notes || "Deployment created",
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
  if (candidateUserId) {
    void sendNotification(
      candidateUserId,
      "Deployment Scheduled",
      `Your deployment record has been created for site: ${resolvedSite || "Main Site"}.`,
      "SUCCESS",
      `/app/profile`
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
      employee: { select: { userId: true } },
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

  void logAudit(actorId || null, "DEPLOYMENT_STATUS_UPDATED", "Deployment", id, {
    deploymentId: id,
    previousStatus: currentStatus,
    status,
    clientName: deployment.client?.name,
    notes,
  });

  if (deployment.employee?.userId) {
    void sendNotification(
      deployment.employee.userId,
      "Deployment Update",
      `Your deployment status has been updated to ${status.replace(/_/g, " ")}.`,
      "INFO",
      `/app/profile`
    );
  }

  return updated;
};

export const listDeployments = async (clientId?: number, status?: string) => {
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

  if (deployment.employee?.userId) {
    void sendNotification(
      deployment.employee.userId,
      "Contract Signed",
      `Deployment contract has been signed by ${party === "WORKER" ? "Candidate" : "Client Partner"}. Status: ${contractStatus}`,
      "SUCCESS",
      `/app/profile`
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

