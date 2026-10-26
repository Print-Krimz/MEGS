import { sendComplianceDueReminders, sendDocUpdateDueReminders, sendToFollowDueReminders } from "./compliance.js";
import { sendContractEndReminders } from "./contract-end.js";
import { sendDocExpiryReminders } from "./doc-expiry.js";
import { sendInterviewFollowupReminders } from "./interview-followup.js";
import { sendInvitationExpiryReminders } from "./invitation-expiry.js";
import { sendMrfTargetReminders } from "./mrf-target.js";
import { sendRedeployFollowupReminders } from "./redeploy-followup.js";

export interface ReminderJob {
  name: string;
  run: () => Promise<Record<string, unknown>>;
}

const job = (name: string, sweep: () => Promise<object>): ReminderJob => ({
  name,
  run: async () => ({ ...(await sweep()) }),
});

export const REMINDER_JOBS: ReminderJob[] = [
  job("compliance-due", () => sendComplianceDueReminders()),
  job("doc-update-due", () => sendDocUpdateDueReminders()),
  job("to-follow-due", () => sendToFollowDueReminders()),
  job("doc-expiry", () => sendDocExpiryReminders()),
  job("interview-followup", () => sendInterviewFollowupReminders()),
  job("invitation-expiry", () => sendInvitationExpiryReminders()),
  job("contract-end", () => sendContractEndReminders()),
  job("redeploy-followup", () => sendRedeployFollowupReminders()),
  job("mrf-target", () => sendMrfTargetReminders()),
];
