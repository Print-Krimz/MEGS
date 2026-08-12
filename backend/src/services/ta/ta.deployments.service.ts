import prisma from "../../utils/prisma.js";
import { DeploymentStatus } from "@prisma/client";
import { isFullyCompliant } from "./ta.compliance.service.js";

const ALLOWED_DEPLOYMENT_TRANSITIONS: Record<string, string[]> = {
  PENDING_ORIENTATION: ["READY", "CANCELLED"],
  READY:               ["DISPATCHED", "CANCELLED"],
  DISPATCHED:          ["ACTIVE", "CANCELLED"],
  ACTIVE:              ["ENDED", "CANCELLED"],
  ENDED:               [],
  CANCELLED:           [],
};

export const createDeployment = async (
  createdById: string,
  data: {
    applicationId: number;
    clientId: number;
    mrfId?: number;
    site?: string;
    contractStart?: string | Date;
    contractEnd?: string | Date;
    notes?: string;
  }
) => {
  const application = await prisma.application.findUnique({
    where: { id: data.applicationId },
    select: { id: true, status: true },
  });

  if (!application) throw new Error("Application not found");
  if (application.status !== "ONBOARDING" && application.status !== "HIRED" && application.status !== "DEPLOYED") {
    throw new Error("Application must be in ONBOARDING or HIRED status to deploy.");
  }

  // Compliance check
  const compliant = await isFullyCompliant(data.applicationId);
  if (!compliant) {
    throw new Error("Cannot deploy candidate. All required compliance documents must be APPROVED.");
  }

  // Active deployment check
  const existingActive = await prisma.deployment.findFirst({
    where: {
      applicationId: data.applicationId,
      status: { notIn: ["ENDED", "CANCELLED"] },
    },
  });

  if (existingActive) {
    throw new Error("Application already has an active deployment.");
  }

  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) throw new Error("Client not found");

  if (data.mrfId) {
    const mrf = await prisma.manpowerRequest.findUnique({ where: { id: data.mrfId } });
    if (!mrf) throw new Error("Manpower Request not found");
  }

  const deployment = await prisma.deployment.create({
    data: {
      applicationId: data.applicationId,
      clientId: data.clientId,
      mrfId: data.mrfId || null,
      createdById,
      site: data.site || null,
      contractStart: data.contractStart ? new Date(data.contractStart) : null,
      contractEnd: data.contractEnd ? new Date(data.contractEnd) : null,
      notes: data.notes || null,
      status: "PENDING_ORIENTATION",
    },
    include: {
      application: {
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

  // Update application status to DEPLOYED
  await prisma.application.update({
    where: { id: data.applicationId },
    data: { status: "DEPLOYED" },
  });

  await prisma.recruiterDecision.create({
    data: {
      applicationId: data.applicationId,
      actorId: createdById,
      fromStatus: application.status,
      toStatus: "DEPLOYED",
      reason: data.notes || "Candidate deployed to client site",
    },
  });

  return deployment;
};

export const updateDeploymentStatus = async (
  id: number,
  status: DeploymentStatus,
  notes?: string
) => {
  const deployment = await prisma.deployment.findUnique({ where: { id } });
  if (!deployment) throw new Error("Deployment not found");

  const currentStatus = deployment.status;
  const allowed = ALLOWED_DEPLOYMENT_TRANSITIONS[currentStatus] ?? [];

  if (!allowed.includes(status)) {
    throw new Error(`Cannot transition deployment from ${currentStatus} to ${status}. Allowed: ${allowed.length ? allowed.join(", ") : "none"}`);
  }

  return await prisma.deployment.update({
    where: { id },
    data: {
      status,
      ...(notes ? { notes } : {}),
    },
    include: {
      application: { select: { id: true, status: true } },
      client: { select: { id: true, name: true } },
    },
  });
};

export const listDeployments = async (clientId?: number, status?: string) => {
  const where: any = {};
  if (clientId) where.clientId = clientId;
  if (status) where.status = status as DeploymentStatus;

  return await prisma.deployment.findMany({
    where,
    include: {
      application: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              applicantProfile: { select: { firstName: true, lastName: true, mobileNumber: true } },
            },
          },
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
      application: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              applicantProfile: true,
            },
          },
          jobPosting: true,
          complianceRequirements: true,
          postHireDocuments: true,
          vault201: true,
        },
      },
      client: true,
      mrf: true,
      createdBy: { select: { id: true, email: true } },
    },
  });

  if (!deployment) throw new Error("Deployment not found");
  return deployment;
};
