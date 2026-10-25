import prisma from "../../utils/prisma.js";
import { autoPromoteDeployments } from "./ta.deployments.service.js";
import { ownedWhere, type Actor } from "./ownership.js";

export const getTADashboardCounts = async (actor?: Actor) => {
  await autoPromoteDeployments();
  const deploymentScope = actor ? ownedWhere.deployment(actor) : {};
  const [openJobs, activeDeployments, awaitingStart] = await Promise.all([
    prisma.jobPosting.count({ where: { AND: [{ status: "OPEN" }, ...(actor ? [ownedWhere.job(actor)] : [])] } }),
    prisma.deployment.count({ where: { status: "ACTIVE", ...deploymentScope } }),
    prisma.deployment.count({ where: { status: "READY_FOR_DEPLOYMENT", ...deploymentScope } }),
  ]);

  return { openJobs, activeDeployments, awaitingStart };
};
