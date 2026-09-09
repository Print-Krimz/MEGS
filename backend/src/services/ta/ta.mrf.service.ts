import prisma from "../../utils/prisma.js";
import { logAudit } from "../../utils/audit.js";
import { sendRoleNotification, sendNotification } from "../../utils/notification.js";

export interface MRFFulfillmentStats {
  mrfId: number;
  headcount: number;
  deployedCount: number;
  remainingCount: number;
  fulfillmentRate: number;
  isFulfilled: boolean;
}

export const calculateMRFFulfillment = async (mrfId: number): Promise<MRFFulfillmentStats> => {
  const mrf = await prisma.manpowerRequest.findUnique({
    where: { id: mrfId },
    select: {
      id: true,
      headcount: true,
      deployments: {
        where: {
          status: {
            in: [
              "READY_FOR_DEPLOYMENT",
              "ACTIVE",
              "READY",
              "DISPATCHED",
              "PENDING_ORIENTATION",
            ],
          },
        },
        select: { id: true },
      },
    },
  });

  if (!mrf) throw new Error(`Manpower Request #${mrfId} not found`);

  const headcount = Math.max(1, mrf.headcount || 1);
  const deployedCount = mrf.deployments.length;
  const remainingCount = Math.max(0, headcount - deployedCount);
  const fulfillmentRate = Math.min(100, Math.round((deployedCount / headcount) * 100));
  const isFulfilled = deployedCount >= headcount;

  return {
    mrfId,
    headcount,
    deployedCount,
    remainingCount,
    fulfillmentRate,
    isFulfilled,
  };
};

export const syncMRFFulfillmentStatus = async (
  mrfId: number,
  actorId?: string
): Promise<{
  mrf: any;
  updated: boolean;
  previousStatus: string;
  newStatus: string;
  closedJobCount: number;
  reopenedJobCount: number;
}> => {
  const mrf = await prisma.manpowerRequest.findUnique({
    where: { id: mrfId },
    include: { client: { select: { id: true, name: true } } },
  });

  if (!mrf) throw new Error(`Manpower Request #${mrfId} not found`);

  const stats = await calculateMRFFulfillment(mrfId);
  const currentStatus = mrf.status;
  let targetStatus = currentStatus;
  let closedJobCount = 0;
  let reopenedJobCount = 0;

  if (stats.isFulfilled && currentStatus === "OPEN") {
    targetStatus = "FILLED";
  } else if (!stats.isFulfilled && currentStatus === "FILLED") {
    targetStatus = "OPEN";
  }

  // Handle Job Posting cascading
  if (targetStatus === "FILLED" && currentStatus === "OPEN") {
    const jobsToClose = await prisma.jobPosting.findMany({
      where: { mrfId, status: "OPEN", isEvergreen: false },
      select: { id: true },
    });
    if (jobsToClose.length > 0) {
      await prisma.jobPosting.updateMany({
        where: { id: { in: jobsToClose.map((j) => j.id) } },
        data: { status: "CLOSED" },
      });
      closedJobCount = jobsToClose.length;
    }
  } else if (targetStatus === "OPEN" && currentStatus === "FILLED") {
    const jobsToReopen = await prisma.jobPosting.findMany({
      where: { mrfId, status: "CLOSED", isEvergreen: false },
      select: { id: true },
    });
    if (jobsToReopen.length > 0) {
      await prisma.jobPosting.updateMany({
        where: { id: { in: jobsToReopen.map((j) => j.id) } },
        data: { status: "OPEN" },
      });
      reopenedJobCount = jobsToReopen.length;
    }
  }

  if (targetStatus === currentStatus) {
    return {
      mrf,
      updated: false,
      previousStatus: currentStatus,
      newStatus: currentStatus,
      closedJobCount,
      reopenedJobCount,
    };
  }

  const updatedMrf = await prisma.manpowerRequest.update({
    where: { id: mrfId },
    data: { status: targetStatus },
    include: { client: { select: { id: true, name: true } } },
  });

  void logAudit(actorId || null, "MRF_STATUS_AUTO_SYNCED", "ManpowerRequest", mrfId, {
    mrfId,
    previousStatus: currentStatus,
    newStatus: targetStatus,
    deployedCount: stats.deployedCount,
    headcount: stats.headcount,
    closedJobCount,
    reopenedJobCount,
  });

  if (targetStatus === "FILLED") {
    void sendRoleNotification(
      "ADMINISTRATOR",
      "MRF Quota Met & Jobs Closed",
      `MRF "${mrf.title}" for ${mrf.client.name} is 100% fulfilled (${stats.deployedCount}/${stats.headcount} pax). ${closedJobCount > 0 ? `${closedJobCount} linked job opening(s) closed.` : ""}`,
      "SUCCESS",
      `/ta/mrfs/${mrf.id}`,
      actorId
    );

    if (mrf.createdById) {
      void sendNotification(
        mrf.createdById,
        "MRF Quota Fulfilled",
        `Your MRF "${mrf.title}" for ${mrf.client.name} is 100% fulfilled (${stats.deployedCount}/${stats.headcount} pax). ${closedJobCount > 0 ? `${closedJobCount} linked job opening(s) closed.` : ""}`,
        "SUCCESS",
        `/ta/mrfs/${mrf.id}`
      );
    }
  } else if (targetStatus === "OPEN" && currentStatus === "FILLED") {
    void sendRoleNotification(
      "ADMINISTRATOR",
      "MRF Quota Reopened",
      `MRF "${mrf.title}" for ${mrf.client.name} reopened due to deployment cancellation (${stats.deployedCount}/${stats.headcount} pax). ${reopenedJobCount > 0 ? `${reopenedJobCount} job(s) reopened.` : ""}`,
      "INFO",
      `/ta/mrfs/${mrf.id}`,
      actorId
    );
  }

  return {
    mrf: updatedMrf,
    updated: true,
    previousStatus: currentStatus,
    newStatus: targetStatus,
    closedJobCount,
    reopenedJobCount,
  };
};

export const listMRFs = async (clientId?: number, status?: string) => {
  const where: any = {};
  if (clientId) where.clientId = clientId;
  if (status) where.status = status;

  const mrfs = await prisma.manpowerRequest.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
      createdBy: { select: { id: true, email: true } },
      deployments: {
        where: {
          status: {
            in: [
              "READY_FOR_DEPLOYMENT",
              "ACTIVE",
              "READY",
              "DISPATCHED",
              "PENDING_ORIENTATION",
            ],
          },
        },
        select: { id: true },
      },
      _count: {
        select: {
          jobPostings: true,
          deployments: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return mrfs.map((mrf) => {
    const headcount = Math.max(1, mrf.headcount || 1);
    const deployedCount = mrf.deployments.length;
    const remainingCount = Math.max(0, headcount - deployedCount);
    const fulfillmentRate = Math.min(100, Math.round((deployedCount / headcount) * 100));
    const isFulfilled = deployedCount >= headcount;

    const { deployments, ...rest } = mrf;
    return {
      ...rest,
      fulfillment: {
        mrfId: mrf.id,
        headcount,
        deployedCount,
        remainingCount,
        fulfillmentRate,
        isFulfilled,
      },
    };
  });
};

export const createMRF = async (
  createdById: string,
  data: {
    clientId: number;
    title: string;
    description?: string;
    headcount?: number;
    location?: string;
    targetFillDate?: string | Date;
    priority?: string;
    requiredSkills?: string;
    requiredExperience?: string;
    requiredEducation?: string;
    requiredCertifications?: string;
    salaryRangeMin?: number;
    salaryRangeMax?: number;
    employmentType?: string;
    workArrangement?: string;
    complianceRequirements?: string;
  }
) => {
  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) throw new Error("Client not found");

  const mrf = await prisma.manpowerRequest.create({
    data: {
      clientId: data.clientId,
      createdById,
      title: data.title,
      description: data.description,
      headcount: data.headcount ?? 1,
      location: data.location,
      targetFillDate: data.targetFillDate ? new Date(data.targetFillDate) : null,
      priority: data.priority ?? "NORMAL",
      requiredSkills: data.requiredSkills,
      requiredExperience: data.requiredExperience,
      requiredEducation: data.requiredEducation,
      requiredCertifications: data.requiredCertifications,
      salaryRangeMin: data.salaryRangeMin,
      salaryRangeMax: data.salaryRangeMax,
      employmentType: data.employmentType,
      workArrangement: data.workArrangement,
      complianceRequirements: data.complianceRequirements,
    },
    include: {
      client: { select: { id: true, name: true } },
      complianceTemplates: true,
    },
  });

  void logAudit(createdById, "MRF_CREATED", "ManpowerRequest", mrf.id, {
    mrfId: mrf.id,
    title: mrf.title,
    clientName: client.name,
    headcount: mrf.headcount,
  });

  void sendRoleNotification(
    "ADMINISTRATOR",
    "New Manpower Request (MRF)",
    `MRF "${mrf.title}" created for ${client.name}. Headcount: ${mrf.headcount}.`,
    "INFO",
    `/admin/mrfs/${mrf.id}`,
    createdById
  );

  return mrf;
};

export const getMRFDetails = async (id: number) => {
  const mrf = await prisma.manpowerRequest.findUnique({
    where: { id },
    include: {
      client: true,
      createdBy: { select: { id: true, email: true } },
      jobPostings: {
        orderBy: { createdAt: "desc" },
      },
      complianceTemplates: true,
      deployments: {
        include: {
          employee: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  applicantProfile: {
                    select: {
                      id: true,
                      firstName: true,
                      middleName: true,
                      lastName: true,
                      mobileNumber: true,
                    },
                  },
                },
              },
            },
          },
          application: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  applicantProfile: {
                    select: {
                      id: true,
                      firstName: true,
                      middleName: true,
                      lastName: true,
                      mobileNumber: true,
                    },
                  },
                },
              },
            },
          },
          statusHistory: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!mrf) throw new Error("Manpower Request not found");

  const fulfillment = await calculateMRFFulfillment(id);

  return {
    ...mrf,
    fulfillment,
  };
};

export const updateMRF = async (
  id: number,
  data: {
    title?: string;
    description?: string;
    headcount?: number;
    location?: string;
    targetFillDate?: string | Date;
    priority?: string;
    requiredSkills?: string;
    requiredExperience?: string;
    requiredEducation?: string;
    requiredCertifications?: string;
    salaryRangeMin?: number;
    salaryRangeMax?: number;
    employmentType?: string;
    workArrangement?: string;
    complianceRequirements?: string;
    status?: string;
  },
  actorId?: string
) => {
  const updateData: any = { ...data };
  if (data.targetFillDate) {
    updateData.targetFillDate = new Date(data.targetFillDate);
  }

  const updated = await prisma.manpowerRequest.update({
    where: { id },
    data: updateData,
    include: {
      client: { select: { id: true, name: true } },
      complianceTemplates: true,
    },
  });

  void logAudit(actorId || null, "MRF_UPDATED", "ManpowerRequest", id, {
    mrfId: id,
    title: updated.title,
    clientName: updated.client?.name,
    status: updated.status,
  });

  return updated;
};

export const addMRFComplianceTemplate = async (
  mrfId: number,
  documentLabel: string,
  isRequired: boolean = true
) => {
  const mrf = await prisma.manpowerRequest.findUnique({ where: { id: mrfId } });
  if (!mrf) throw new Error("Manpower Request not found");

  return await (prisma as any).mRFComplianceTemplate.create({
    data: {
      mrfId,
      documentLabel,
      isRequired,
    },
  });
};

export const listMRFComplianceTemplates = async (mrfId: number) => {
  return await (prisma as any).mRFComplianceTemplate.findMany({
    where: { mrfId },
    orderBy: { createdAt: "asc" },
  });
};

export const removeMRFComplianceTemplate = async (templateId: number) => {
  return await (prisma as any).mRFComplianceTemplate.delete({
    where: { id: templateId },
  });
};

export const linkJobToMRF = async (mrfId: number, jobPostingId: number) => {
  const mrf = await prisma.manpowerRequest.findUnique({ where: { id: mrfId } });
  if (!mrf) throw new Error("Manpower Request not found");

  const job = await prisma.jobPosting.findUnique({ where: { id: jobPostingId } });
  if (!job) throw new Error("Job posting not found");

  return await prisma.jobPosting.update({
    where: { id: jobPostingId },
    data: { mrfId },
  });
};
