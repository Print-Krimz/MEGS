import prisma from "../../utils/prisma.js";
import { EmploymentStatus, EmploymentEventType, DeploymentStatus } from "@prisma/client";

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
    email: string;
    profile: any;
    workExperiences: any[];
    educations: any[];
    skills: any[];
    trainings: any[];
    assets: any[];
    characterReferences: any[];
    documents: any[];
  };
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
      email: employee.user.email,
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
            photoUrl: profile.photoUrl,
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
    originatingApplication: employee.originatingApplication ?? null,
    compliance: employee.originatingApplication?.complianceRequirements ?? [],
    deployments: employee.deployments ?? [],
    employmentHistory: employee.employmentEvents ?? [],
  };
};

/**
 * Aggregates complete Digital 201 personnel record for an Employee by userId.
 */
export const getDigital201ByUserId = async (userId: string): Promise<Digital201Aggregate> => {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!employee) {
    throw new Error("Employee record not found for this user");
  }

  return await getDigital201ByEmployeeId(employee.id);
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
}) => {
  const where: any = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.department) {
    where.department = { contains: filters.department, mode: "insensitive" };
  }

  if (filters.search) {
    where.OR = [
      { employeeNumber: { contains: filters.search, mode: "insensitive" } },
      { position: { contains: filters.search, mode: "insensitive" } },
      {
        user: {
          applicantProfile: {
            OR: [
              { firstName: { contains: filters.search, mode: "insensitive" } },
              { lastName: { contains: filters.search, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
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

  return items;
};

/**
 * Get basic employee details by ID.
 */
export const getEmployeeById = async (id: number) => {
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
  return employee;
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

  const eventType: EmploymentEventType =
    status === "SEPARATED"
      ? "SEPARATED"
      : status === "AVAILABLE_FOR_REDEPLOYMENT"
      ? "STATUS_CHANGE"
      : "STATUS_CHANGE";

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id: employeeId },
      data: { status },
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
  }
) => {
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
  }

  return await prisma.$transaction(async (tx) => {
    const deployment = await tx.deployment.create({
      data: {
        employeeId: data.employeeId,
        applicationId: data.applicationId ?? employee.originatingApplicationId ?? null,
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
    await tx.deploymentStatusHistory.create({
      data: {
        deploymentId: deployment.id,
        toStatus: "PENDING_ORIENTATION",
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
        effectiveDate: data.contractStart ? new Date(data.contractStart) : new Date(),
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
};

/**
 * End an employee's deployment and optionally return them to the Redeployment Pool.
 */
export const endEmployeeDeployment = async (
  deploymentId: number,
  actorId: string,
  options?: {
    reason?: string;
    makeAvailableForRedeployment?: boolean;
  }
) => {
  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    include: { client: true },
  });

  if (!deployment) throw new Error("Deployment not found");
  if (deployment.status === "ENDED" || deployment.status === "CANCELLED") {
    throw new Error(`Deployment is already in ${deployment.status} state`);
  }

  const now = new Date();
  const effectiveEnd =
    deployment.contractStart && deployment.contractStart > now
      ? deployment.contractStart
      : (deployment.contractEnd && deployment.contractEnd < now ? deployment.contractEnd : now);

  return await prisma.$transaction(async (tx) => {
    const updatedDeployment = await tx.deployment.update({
      where: { id: deploymentId },
      data: {
        status: "ENDED",
        contractEnd: effectiveEnd,
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
        effectiveDate: new Date(),
        actorId,
        metadata: {
          deploymentId,
          clientId: deployment.clientId,
          reason: options?.reason,
        },
      },
    });

    if (options?.makeAvailableForRedeployment) {
      await tx.employee.update({
        where: { id: deployment.employeeId },
        data: { status: "AVAILABLE_FOR_REDEPLOYMENT" },
      });

      await tx.employmentEvent.create({
        data: {
          employeeId: deployment.employeeId,
          eventType: "STATUS_CHANGE",
          description: "Employee marked as AVAILABLE FOR REDEPLOYMENT",
          effectiveDate: new Date(),
          actorId,
        },
      });
    }

    return updatedDeployment;
  });
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
