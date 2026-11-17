import prisma from "../utils/prisma.js";
import { safeLogError } from "../security/errors.js";
import { getAppBaseUrl, sendMail } from "../utils/mailer.js";
import { sendNotification } from "../utils/notification.js";
import { isSyntheticEmail } from "../utils/sms.js";
import { buildJobAlertEmail } from "../utils/job-alert-email.js";
import { createUnsubscribeToken } from "../utils/job-alert-token.js";
import { recommendJobsForApplicant } from "../services/applicant/job-recommendation.service.js";

const MAX_APPLICANTS_PER_RUN = 100;
// The scheduler holds its lock for at most 10 minutes; stop well before that.
const TIME_BUDGET_MS = 5 * 60_000;
const MAX_JOBS_PER_ALERT = 5;
const SEND_FROM_HOUR = 8;
const SEND_UNTIL_HOUR = 20;
const HOUR_MS = 60 * 60_000;
// Slack so an hourly run just before the 7-day mark does not push the alert a whole extra hour out of cadence.
const WEEK_MS = 7 * 24 * HOUR_MS - 2 * HOUR_MS;
const DAY_MS = 24 * HOUR_MS;

export type JobAlertsResult = {
  skipped?: string;
  scannedCount: number;
  sentCount: number;
  textCount: number;
  noMatchCount: number;
  deployedCount: number;
  failedCount: number;
};

const manila = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { dateKey: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
};

/** Daily alerts go once per Manila calendar day; weekly ones once a week. Both only in the daytime. */
export const isAlertDue = (cadence: "DAILY" | "WEEKLY", lastSent: Date | null, now: Date): boolean => {
  const { hour, dateKey } = manila(now);
  if (hour < SEND_FROM_HOUR || hour >= SEND_UNTIL_HOUR) return false;
  if (!lastSent) return true;
  return cadence === "DAILY" ? manila(lastSent).dateKey !== dateKey : now.getTime() - lastSent.getTime() >= WEEK_MS;
};

const API_UNSUBSCRIBE_PATH = "/api/public/job-alerts/unsubscribe";

const unsubscribeLinks = (userId: string) => {
  const token = encodeURIComponent(createUnsubscribeToken(userId));
  const apiBase = process.env.API_PUBLIC_URL?.trim().replace(/\/+$/, "");
  return {
    page: `${getAppBaseUrl()}/unsubscribe?token=${token}`,
    // Gmail and Yahoo want an https URL that unsubscribes on a POST. Without a public API address, leave the header out.
    oneClick: apiBase?.startsWith("https://") ? `${apiBase}${API_UNSUBSCRIBE_PATH}?token=${token}` : null,
  };
};

const notRealEmail = (email: string | null | undefined) => !email || isSyntheticEmail(email);

/** Sends the job alert emails (and opt-in texts) that are due. Off unless JOB_ALERTS_ENABLED=true. */
export const sendJobAlerts = async (now: Date = new Date()): Promise<JobAlertsResult> => {
  const result: JobAlertsResult = { scannedCount: 0, sentCount: 0, textCount: 0, noMatchCount: 0, deployedCount: 0, failedCount: 0 };
  if (process.env.JOB_ALERTS_ENABLED !== "true") return { ...result, skipped: "disabled" };
  const { hour } = manila(now);
  if (hour < SEND_FROM_HOUR || hour >= SEND_UNTIL_HOUR) return { ...result, skipped: "outside send hours" };

  const dailyCutoff = new Date(now.getTime() - (DAY_MS - 2 * HOUR_MS));
  const weeklyCutoff = new Date(now.getTime() - WEEK_MS);
  const lastSentBefore = (cutoff: Date) => ({ OR: [{ jobAlertLastSentAt: null }, { jobAlertLastSentAt: { lt: cutoff } }] });

  const applicants = await prisma.applicantProfile.findMany({
    where: {
      isActive: true,
      AND: [
        {
          OR: [
            { jobAlertEmail: "DAILY", ...lastSentBefore(dailyCutoff) },
            { jobAlertEmail: { in: ["WEEKLY", "OFF"] }, ...lastSentBefore(weeklyCutoff) },
          ],
        },
        // Something to send to: a real email with email alerts on, or opt-in texts.
        {
          OR: [
            { jobAlertSms: true },
            {
              jobAlertEmail: { not: "OFF" },
              user: { AND: [{ email: { not: { endsWith: "@applicant.megs.local" } } }, { email: { not: { endsWith: "@megs.internal" } } }] },
            },
          ],
        },
      ],
    },
    orderBy: { jobAlertLastSentAt: { sort: "asc", nulls: "first" } },
    take: MAX_APPLICANTS_PER_RUN,
    select: { userId: true, jobAlertEmail: true, jobAlertSms: true, jobAlertLastSentAt: true, user: { select: { email: true } } },
  });

  const started = Date.now();
  for (const applicant of applicants) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    const { userId } = applicant;
    const cadence = applicant.jobAlertEmail === "DAILY" ? "DAILY" : "WEEKLY";
    if (!isAlertDue(cadence, applicant.jobAlertLastSentAt, now)) continue;
    result.scannedCount += 1;

    try {
      const markEvaluated = () =>
        prisma.applicantProfile.update({ where: { userId }, data: { jobAlertLastSentAt: now }, select: { id: true } });

      const deployed = await prisma.deployment.findFirst({
        where: { employee: { userId }, status: { notIn: ["ENDED", "CANCELLED"] } },
        select: { id: true },
      });
      if (deployed) {
        result.deployedCount += 1;
        await markEvaluated();
        continue;
      }

      const { items } = await recommendJobsForApplicant(userId, { limit: MAX_JOBS_PER_ALERT, forDigest: true });
      if (items.length === 0) {
        result.noMatchCount += 1;
        await markEvaluated();
        continue;
      }

      const jobs = items.map(({ job, reasons }) => ({ ...job, reasons }));
      const emailOn = applicant.jobAlertEmail !== "OFF" && !notRealEmail(applicant.user.email);
      const lastText = applicant.jobAlertSms
        ? await prisma.jobRecommendationEvent.findFirst({ where: { userId, kind: "SMS" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } })
        : null;
      const textOn = applicant.jobAlertSms && (!lastText || now.getTime() - lastText.createdAt.getTime() >= WEEK_MS);

      if (emailOn) {
        const links = unsubscribeLinks(userId);
        const { subject, text, html } = buildJobAlertEmail({ jobs, unsubscribeUrl: links.page });
        // A failed send throws: the applicant stays due and is tried again next hour.
        await sendMail(
          applicant.user.email,
          subject,
          text,
          html,
          links.oneClick ? { "List-Unsubscribe": `<${links.oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined,
        );
        result.sentCount += 1;
      }

      const count = jobs.length;
      const message = `${count} new ${count === 1 ? "job matches" : "jobs match"} your profile. Log in to MEGS for details.`;
      await sendNotification(userId, "New jobs match your profile", message, "INFO", "/app/recommended", {
        dedupeKey: `job-alert:${userId}:${manila(now).dateKey}`,
        ...(textOn ? { sms: { text: message, always: true } } : {}),
      });
      if (textOn) result.textCount += 1;

      const kinds = [...(emailOn ? ["EMAILED"] : []), ...(textOn ? ["SMS"] : [])];
      if (kinds.length) {
        await prisma.jobRecommendationEvent.createMany({
          data: items.flatMap(({ job }) => kinds.map((kind) => ({ userId, jobPostingId: job.id, kind }))),
          skipDuplicates: true,
        });
      }
      await markEvaluated();
    } catch (error) {
      result.failedCount += 1;
      safeLogError("Job alert", error);
    }
  }
  return result;
};
