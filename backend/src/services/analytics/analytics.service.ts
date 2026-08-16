import prisma from "../../utils/prisma.js";

export const getPipelineStats = async () => {
  const counts = await prisma.application.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const total = await prisma.application.count();
  const archived = await prisma.application.count({ where: { isArchived: true } });

  const statusBreakdown: Record<string, number> = {};
  for (const c of counts) {
    statusBreakdown[c.status] = c._count._all;
  }

  return {
    totalApplications: total,
    archivedApplications: archived,
    statusBreakdown,
  };
};

export const getTimeToFillStats = async (mrfId?: number) => {
  const deployments = await prisma.deployment.findMany({
    where: {
      ...(mrfId ? { mrfId } : {}),
      status: { in: ["ACTIVE", "READY_FOR_DEPLOYMENT"] },
    },
    include: {
      mrf: { select: { id: true, title: true, createdAt: true } },
      application: { select: { id: true, createdAt: true } },
    },
  });

  let totalDays = 0;
  let count = 0;

  const records = deployments.map((d) => {
    const startDate = d.mrf?.createdAt || d.application?.createdAt || d.createdAt;
    const endDate = d.createdAt;
    const diffMs = endDate.getTime() - startDate.getTime();
    const days = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    totalDays += days;
    count++;
    return {
      deploymentId: d.id,
      mrfTitle: d.mrf?.title || "Direct Job",
      daysToFill: days,
      createdDate: startDate,
      deployedDate: endDate,
    };
  });

  const averageDaysToFill = count > 0 ? Number((totalDays / count).toFixed(1)) : 0;

  return {
    averageDaysToFill,
    totalFilledDeployments: count,
    details: records,
  };
};

export const getDeploymentStats = async (clientId?: number) => {
  const counts = await prisma.deployment.groupBy({
    by: ["status"],
    where: clientId ? { clientId } : undefined,
    _count: { _all: true },
  });

  const total = await prisma.deployment.count({
    where: clientId ? { clientId } : undefined,
  });

  const statusBreakdown: Record<string, number> = {};
  for (const c of counts) {
    statusBreakdown[c.status] = c._count._all;
  }

  return {
    totalDeployments: total,
    statusBreakdown,
  };
};

export const getComplianceOverview = async () => {
  const counts = await prisma.complianceRequirement.groupBy({
    by: ["reviewStatus"],
    _count: { _all: true },
  });

  const total = await prisma.complianceRequirement.count();

  const statusBreakdown: Record<string, number> = {};
  for (const c of counts) {
    statusBreakdown[c.reviewStatus] = c._count._all;
  }

  return {
    totalRequirements: total,
    statusBreakdown,
  };
};
