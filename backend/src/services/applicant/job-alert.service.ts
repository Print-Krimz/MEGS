import prisma from "../../utils/prisma.js";
import { findSmsPhone } from "../../utils/notification.js";
import { isSyntheticEmail, maskPhoneNumber } from "../../utils/sms.js";

export type JobAlertEmail = "WEEKLY" | "DAILY" | "OFF";

export type JobAlertSettings = {
  email: JobAlertEmail;
  sms: boolean;
  expectedMonthlySalary: number | null;
  /** False for phone-only and walk-in accounts that have no real email address. */
  hasEmail: boolean;
  /** Masked number a text would go to, or null when the account has no Philippine mobile number. */
  smsPhone: string | null;
};

export class JobAlertError extends Error {}

const load = async (userId: string) => {
  const profile = await prisma.applicantProfile.findUnique({
    where: { userId },
    select: {
      jobAlertEmail: true,
      jobAlertSms: true,
      expectedMonthlySalary: true,
      user: { select: { email: true } },
    },
  });
  if (!profile) throw new JobAlertError("Complete your profile first.");
  return profile;
};

const toSettings = async (userId: string, profile: Awaited<ReturnType<typeof load>>): Promise<JobAlertSettings> => {
  const phone = await findSmsPhone(userId);
  return {
    email: profile.jobAlertEmail as JobAlertEmail,
    sms: profile.jobAlertSms,
    expectedMonthlySalary: profile.expectedMonthlySalary,
    hasEmail: Boolean(profile.user.email) && !isSyntheticEmail(profile.user.email),
    smsPhone: phone ? maskPhoneNumber(phone) : null,
  };
};

/** Stops job emails for a user. Safe to repeat. Texts stay as the applicant set them. */
export const turnOffJobAlertEmail = async (userId: string) => {
  await prisma.applicantProfile.updateMany({ where: { userId }, data: { jobAlertEmail: "OFF" } });
};

export const getJobAlertSettings = async (userId: string) => toSettings(userId, await load(userId));

export const updateJobAlertSettings = async (
  userId: string,
  input: { email?: JobAlertEmail; sms?: boolean; expectedMonthlySalary?: number | null },
) => {
  const current = await load(userId);
  const data: Record<string, unknown> = {};

  if (input.email !== undefined) {
    data.jobAlertEmail = input.email;
    if (input.email !== "OFF" && current.jobAlertEmail === "OFF") data.jobAlertConsentAt = new Date();
  }
  if (input.sms !== undefined) {
    if (input.sms && !(await findSmsPhone(userId))) {
      throw new JobAlertError("Add a Philippine mobile number to your profile before turning on text alerts.");
    }
    data.jobAlertSms = input.sms;
    // Text alerts are opt-in only: record when the applicant agreed.
    if (input.sms && !current.jobAlertSms) data.jobAlertConsentAt = new Date();
  }
  if (input.expectedMonthlySalary !== undefined) data.expectedMonthlySalary = input.expectedMonthlySalary;

  const updated = Object.keys(data).length
    ? await prisma.applicantProfile.update({
        where: { userId },
        data,
        select: { jobAlertEmail: true, jobAlertSms: true, expectedMonthlySalary: true, user: { select: { email: true } } },
      })
    : current;
  return toSettings(userId, updated);
};
