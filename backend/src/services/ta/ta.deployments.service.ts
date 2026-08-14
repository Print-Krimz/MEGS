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
    applicationId?: number;
    employeeId?: number;
    clientId: number;
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
      include: { hiredEmployee: true, user: true },
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

  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) throw new Error("Client not found");

  if (data.mrfId) {
    const mrf = await prisma.manpowerRequest.findUnique({ where: { id: data.mrfId } });
    if (!mrf) throw new Error("Manpower Request not found");
  }

  const deployment = await prisma.deployment.create({
    data: {
      employeeId: empId,
      applicationId: data.applicationId || employee.originatingApplicationId || null,
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
      toStatus: "PENDING_ORIENTATION",
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
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          status: true,
        },
      },
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
