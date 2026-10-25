// Entry point for Heroku Scheduler (`npm run jobs:run`, hourly). Runs the deadline jobs once and exits.
import prisma from "../utils/prisma.js";
import { safeLogError } from "../security/errors.js";
import { runScheduledJobs } from "./scheduled-jobs.js";

runScheduledJobs()
  .then(({ failedJobs }) => {
    // A non-zero exit shows up as a failed run in Heroku Scheduler.
    if (failedJobs.length > 0) process.exitCode = 1;
  })
  .catch((error) => {
    safeLogError("Scheduled jobs run", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
