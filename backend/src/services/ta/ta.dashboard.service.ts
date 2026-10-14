import prisma from "../../utils/prisma.js";
import { autoPromoteDeployments } from "./ta.deployments.service.js";
import { ownedWhere, type Actor } from "./ownership.js";

export const getTADashboardCounts = async (actor?: Actor) => {
  await autoPromoteDeployments();
  const [openJobs, activeDeployments] = await Promise.all([
    prisma.jobPosting.count({ where: { AND: [{ status: "OPEN" }, ...(actor ? [ownedWhere.job(actor)] : [])] } }),
    prisma.deployment.count({ where: { status: "ACTIVE", ...(actor ? ownedWhere.deployment(actor) : {}) } }),
  ]);

  return { openJobs, activeDeployments };
};
