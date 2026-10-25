import prisma from "../../utils/prisma.js";
import type { Prisma } from "@prisma/client";
import { logAudit } from "../../utils/audit.js";
import { sendRoleNotification, sendNotification } from "../../utils/notification.js";
import { assertOwns, ownedWhere, type Actor } from "./ownership.js";
import { jobRequirementClarity } from "../scoring/match-score.js";
import { isPageRequested, pageEnvelope, resolvePage, type PageRequest } from "../../utils/pagination.js";
import { isValidDateOnly, manilaDateString, parseManilaDateOnly, toManilaDateOnly } from "../../schemas/field-limits.js";

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
      `/admin/mrfs/${mrf.id}`,
      actorId
    );

    // Admins were told above; also tell the assigned TA, who owns the requisition.
    if (mrf.assignedTaId && mrf.assignedTaId !== actorId) {
      void sendNotification(
        mrf.assignedTaId,
        "MRF Quota Fulfilled",
        `MRF "${mrf.title}" for ${mrf.client.name} is 100% fulfilled (${stats.deployedCount}/${stats.headcount} pax). ${closedJobCount > 0 ? `${closedJobCount} linked job opening(s) closed.` : ""}`,
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
      `/admin/mrfs/${mrf.id}`,
      actorId
    );

    if (mrf.assignedTaId && mrf.assignedTaId !== actorId) {
      void sendNotification(
        mrf.assignedTaId,
        "MRF Quota Reopened",
        `MRF "${mrf.title}" has reopened due to deployment cancellation (${stats.deployedCount}/${stats.headcount} pax).`,
        "INFO",
        `/ta/mrfs/${mrf.id}`
      );
    }
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

export const syncMRFStatusWithHeadcount = syncMRFFulfillmentStatus;

export type MRFSortOption = "priority" | "created_desc" | "created_asc" | "target_date";

const PRIORITY_RANK: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

const STATUS_ACTIVE_RANK: Record<string, number> = {
  OPEN: 2,
  IN_PROGRESS: 2,
  ON_HOLD: 1,
  FILLED: 0,
  CANCELLED: 0,
};

type MRFSortKey = { id: number; status: string; priority: string; targetFillDate: Date | string | null; createdAt: Date | string };

const compareMRFs = (sortBy: MRFSortOption) => (a: MRFSortKey, b: MRFSortKey): number => {
  if (sortBy === "priority") {
    // 1. Active status first (OPEN / IN_PROGRESS > ON_HOLD > FILLED / CANCELLED)
    const statusDiff = (STATUS_ACTIVE_RANK[b.status] ?? 1) - (STATUS_ACTIVE_RANK[a.status] ?? 1);
    if (statusDiff !== 0) return statusDiff;

    // 2. Priority rank (URGENT > HIGH > NORMAL > LOW)
    const priorityDiff = (PRIORITY_RANK[b.priority] ?? 2) - (PRIORITY_RANK[a.priority] ?? 2);
    if (priorityDiff !== 0) return priorityDiff;

    // 3. Target Fill Date (soonest first)
    if (a.targetFillDate && b.targetFillDate) {
      const dateDiff = new Date(a.targetFillDate).getTime() - new Date(b.targetFillDate).getTime();
      if (dateDiff !== 0) return dateDiff;
    } else if (a.targetFillDate && !b.targetFillDate) {
      return -1;
    } else if (!a.targetFillDate && b.targetFillDate) {
      return 1;
    }

    // 4. Chronological fallback (newest first), then higher id first as a stable tiebreaker
    const chronoDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (chronoDiff !== 0) return chronoDiff;
    return b.id - a.id;
  }

  if (sortBy === "created_asc") {
    const chronoDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (chronoDiff !== 0) return chronoDiff;
    return a.id - b.id;
  }

  if (sortBy === "target_date") {
    if (a.targetFillDate && b.targetFillDate) {
      const dateDiff = new Date(a.targetFillDate).getTime() - new Date(b.targetFillDate).getTime();
      if (dateDiff !== 0) return dateDiff;
    } else if (a.targetFillDate) {
      return -1;
    } else if (b.targetFillDate) {
      return 1;
    }
    const chronoDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (chronoDiff !== 0) return chronoDiff;
    return b.id - a.id;
  }

  const chronoDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  if (chronoDiff !== 0) return chronoDiff;
  return b.id - a.id;
};

const MRF_LIST_INCLUDE: Prisma.ManpowerRequestInclude = {
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
};

export interface MRFListOptions extends PageRequest {
  search?: string;
}

export const listMRFs = async (
  clientId?: number,
  status?: string,
  priority?: string,
  sortBy: MRFSortOption = "priority",
  actor?: Actor,
  options: MRFListOptions = {}
) => {
  const where: any = actor ? { ...ownedWhere.mrf(actor) } : {};
  if (clientId) where.clientId = clientId;
  if (status) where.status = status;
  if (priority) where.priority = priority;
  const search = options.search?.trim();
  if (search) {
    where.AND = [{ OR: [{ title: { contains: search, mode: "insensitive" } }, { client: { name: { contains: search, mode: "insensitive" } } }] }];
  }

  const mapMRF = (mrf: any) => {
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
  };

  if (isPageRequested(options)) {
    // Filter and order on a lean projection, then load full rows for the requested page only.
    const keys = await prisma.manpowerRequest.findMany({
      where,
      select: { id: true, status: true, priority: true, targetFillDate: true, createdAt: true },
    });
    const { page, pageSize, skip, take } = resolvePage(options);
    const pageIds = keys.sort(compareMRFs(sortBy)).slice(skip, skip + take).map((key) => key.id);
    const rows = pageIds.length
      ? await prisma.manpowerRequest.findMany({ where: { ...where, id: { in: pageIds } }, include: MRF_LIST_INCLUDE })
      : [];
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items = pageIds.flatMap((id) => (byId.has(id) ? [mapMRF(byId.get(id))] : []));
    return pageEnvelope(items, keys.length, page, pageSize);
  }

  const mrfs = await prisma.manpowerRequest.findMany({
    where,
    include: MRF_LIST_INCLUDE,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return mrfs.map(mapMRF).sort(compareMRFs(sortBy));
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
    ageMin?: number | null;
    ageMax?: number | null;
    genderPreference?: string | null;
    tattooPolicy?: string | null;
  },
  actor?: Actor
) => {
  if (data.targetFillDate) {
    const target = String(data.targetFillDate).slice(0, 10);
    if (!isValidDateOnly(target) || target < manilaDateString()) {
      throw new Error("Target fill date must be today or a future date.");
    }
  }
  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) throw new Error("Client not found");
  if (actor) await assertOwns("client", data.clientId, actor);

  const mrf = await prisma.manpowerRequest.create({
    data: {
      clientId: data.clientId,
      createdById,
      ...(actor?.role === "TALENT_ACQUISITION" ? { assignedTaId: actor.id } : {}),
      title: data.title,
      description: data.description,
      headcount: data.headcount ?? 1,
      location: data.location,
      targetFillDate: data.targetFillDate ? parseManilaDateOnly(String(data.targetFillDate).slice(0, 10)) : null,
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
      ageMin: (data.ageMin as any) === "" || data.ageMin === null || data.ageMin === undefined ? null : Number(data.ageMin),
      ageMax: (data.ageMax as any) === "" || data.ageMax === null || data.ageMax === undefined ? null : Number(data.ageMax),
      genderPreference: (data.genderPreference as any) === "" || data.genderPreference === null ? null : data.genderPreference,
      tattooPolicy: (data.tattooPolicy as any) === "" || data.tattooPolicy === null ? null : data.tattooPolicy,
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
    requirementClarity: jobRequirementClarity({ title: mrf.title, requirements: "", location: mrf.location }, mrf),
  };
};

// Manual status moves. CANCELLED is final for manual edits (no reopening a cancelled request).
// FILLED stays selectable by hand as before; syncMRFFulfillmentStatus also derives it from deployments and is not checked here.
const MRF_MANUAL_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["IN_PROGRESS", "ON_HOLD", "FILLED", "CANCELLED"],
  IN_PROGRESS: ["OPEN", "ON_HOLD", "FILLED", "CANCELLED"],
  ON_HOLD: ["OPEN", "IN_PROGRESS", "FILLED", "CANCELLED"],
  FILLED: ["OPEN", "IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  CANCELLED: [],
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
    ageMin?: number | null;
    ageMax?: number | null;
    genderPreference?: string | null;
    tattooPolicy?: string | null;
    status?: string;
  },
  actorId?: string
) => {
  // The schema rejects a blank title too; this guards direct callers because title is a required column.
  if (data.title !== undefined && !(data.title ?? "").trim()) throw new Error("Request title is required.");
  const currentMrf = await prisma.manpowerRequest.findUnique({
    where: { id },
    select: { targetFillDate: true, headcount: true, salaryRangeMin: true, salaryRangeMax: true, ageMin: true, ageMax: true, status: true },
  });
  if (!currentMrf) throw new Error("Manpower Request not found");
  if (data.status !== undefined && data.status !== currentMrf.status) {
    const allowed = MRF_MANUAL_TRANSITIONS[currentMrf.status] ?? [];
    if (!allowed.includes(data.status)) {
      throw new Error("This request can't be moved to the selected status from its current status.");
    }
  }
  if (data.targetFillDate) {
    const target = String(data.targetFillDate).slice(0, 10);
    const previousTarget = currentMrf.targetFillDate ? toManilaDateOnly(currentMrf.targetFillDate) : undefined;
    if (!isValidDateOnly(target) || (target < manilaDateString() && target !== previousTarget)) {
      throw new Error("Target fill date must be today or a future date.");
    }
  }
  // The schema only sees this body, so compare the effective values (incoming, else stored) against the stored row.
  // Only checked when the request touches the field, so unrelated edits to legacy rows are not blocked.
  const effectiveValue = (incoming: unknown, stored: number | null) =>
    incoming === undefined ? stored : incoming === null || incoming === "" ? null : Number(incoming);
  if (data.salaryRangeMin !== undefined || data.salaryRangeMax !== undefined) {
    const minSalary = effectiveValue(data.salaryRangeMin, currentMrf.salaryRangeMin);
    const maxSalary = effectiveValue(data.salaryRangeMax, currentMrf.salaryRangeMax);
    if (minSalary != null && maxSalary != null && minSalary > maxSalary) {
      throw new Error("Minimum salary can't be higher than maximum salary.");
    }
  }
  if (data.ageMin !== undefined || data.ageMax !== undefined) {
    const minAge = effectiveValue(data.ageMin, currentMrf.ageMin);
    const maxAge = effectiveValue(data.ageMax, currentMrf.ageMax);
    if (minAge != null && maxAge != null && minAge > maxAge) {
      throw new Error("Minimum age can't be higher than maximum age.");
    }
  }
  if (data.headcount !== undefined && Number(data.headcount) !== currentMrf.headcount) {
    const { deployedCount } = await calculateMRFFulfillment(id);
    if (Number(data.headcount) < deployedCount) {
      throw new Error(`Headcount can't be lower than the ${deployedCount} already deployed.`);
    }
  }
  const updateData: any = { ...data };
  if (data.targetFillDate) {
    updateData.targetFillDate = parseManilaDateOnly(String(data.targetFillDate).slice(0, 10));
  } else if ((data.targetFillDate as any) === "" || data.targetFillDate === null) {
    updateData.targetFillDate = null;
  }
  if (data.salaryRangeMin !== undefined) {
    updateData.salaryRangeMin = (data.salaryRangeMin as any) === "" || data.salaryRangeMin === null ? null : Number(data.salaryRangeMin);
  }
  if (data.salaryRangeMax !== undefined) {
    updateData.salaryRangeMax = (data.salaryRangeMax as any) === "" || data.salaryRangeMax === null ? null : Number(data.salaryRangeMax);
  }
  if (data.ageMin !== undefined) {
    updateData.ageMin = (data.ageMin as any) === "" || data.ageMin === null ? null : Number(data.ageMin);
  }
  if (data.ageMax !== undefined) {
    updateData.ageMax = (data.ageMax as any) === "" || data.ageMax === null ? null : Number(data.ageMax);
  }
  if (data.genderPreference !== undefined) {
    updateData.genderPreference = (data.genderPreference as any) === "" || data.genderPreference === null ? null : data.genderPreference;
  }
  if (data.tattooPolicy !== undefined) {
    updateData.tattooPolicy = (data.tattooPolicy as any) === "" || data.tattooPolicy === null ? null : data.tattooPolicy;
  }
  if (data.headcount !== undefined) {
    updateData.headcount = Number(data.headcount);
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

export const addMRFComplianceTemplatesBulk = async (
  mrfId: number,
  documentLabels: string[],
  isRequired: boolean = true
) => {
  const mrf = await prisma.manpowerRequest.findUnique({ where: { id: mrfId } });
  if (!mrf) throw new Error("Manpower Request not found");

  const existingTemplates = await (prisma as any).mRFComplianceTemplate.findMany({
    where: { mrfId },
  });

  const existingLower = new Set(
    existingTemplates.map((t: any) => (t.documentLabel || "").trim().toLowerCase())
  );

  const seenInInput = new Set<string>();
  const uniqueLabels: string[] = [];

  for (const rawLabel of documentLabels) {
    const trimmed = (rawLabel || "").trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!existingLower.has(lower) && !seenInInput.has(lower)) {
      seenInInput.add(lower);
      uniqueLabels.push(trimmed);
    }
  }

  if (uniqueLabels.length > 0) {
    await (prisma as any).mRFComplianceTemplate.createMany({
      data: uniqueLabels.map((label) => ({
        mrfId,
        documentLabel: label,
        isRequired,
      })),
    });
  }

  return {
    count: uniqueLabels.length,
    added: uniqueLabels,
  };
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

export const linkJobToMRF = async (mrfId: number, jobPostingId: number, actor?: Actor) => {
  if (actor) {
    await assertOwns("mrf", mrfId, actor);
    await assertOwns("job", jobPostingId, actor);
  }
  const mrf = await prisma.manpowerRequest.findUnique({ where: { id: mrfId } });
  if (!mrf) throw new Error("Manpower Request not found");

  const job = await prisma.jobPosting.findUnique({ where: { id: jobPostingId } });
  if (!job) throw new Error("Job posting not found");

  return await prisma.jobPosting.update({
    where: { id: jobPostingId },
    data: { mrfId },
  });
};
