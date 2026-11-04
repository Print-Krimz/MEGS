import prisma from "../../utils/prisma.js";
import { sendMail, renderBrandedEmail, escapeHtml, getAppBaseUrl } from "../../utils/mailer.js";
import { isSyntheticEmail, sendSmsViaTextBee, isPhilippinePhone, normalizeToE164 } from "../../utils/sms.js";
import { findSmsPhone, formatSms } from "../../utils/notification.js";
import { logAudit } from "../../utils/audit.js";
import { resolveAuthIdentifier, findUserByIdentifier, findClaimableUser } from "./auth.service.js";

export type SecurityEvent =
  | "SIGN_IN_LIMITED" | "RESET_LIMITED" | "CODE_LOCKOUT" | "MFA_RECOVERY_FAILED" | "CLAIM_LIMITED" // suspicious: deduped
  | "MFA_CHANGED" | "PASSWORD_RESET" | "PASSWORD_CHANGED" | "MFA_RECOVERY_CODE_USED" | "MFA_RESET_BY_ADMIN"; // credential change: never deduped

const SUSPICIOUS_CLOSING = "If this was you, no action needed. If not, change your password now.";
const CREDENTIAL_CLOSING = "If this was not you, reset your password now and contact your administrator.";

const COPY: Record<SecurityEvent, { subject: string; what: string; sms: string }> = {
  SIGN_IN_LIMITED: {
    subject: "Repeated sign-in attempts blocked",
    what: "We blocked repeated sign-in attempts on your MEGS account.",
    sms: "Repeated sign-in attempts were blocked on your account.",
  },
  RESET_LIMITED: {
    subject: "Repeated password reset requests blocked",
    what: "We blocked repeated password reset requests for your MEGS account.",
    sms: "Repeated password reset requests were blocked.",
  },
  CODE_LOCKOUT: {
    subject: "Verification code locked",
    what: "A verification code for your MEGS account was locked after too many wrong tries.",
    sms: "A verification code was locked after too many wrong tries.",
  },
  MFA_RECOVERY_FAILED: {
    subject: "Wrong recovery code entered",
    what: "Someone entered a wrong recovery code for your MEGS account.",
    sms: "A wrong recovery code was entered on your account.",
  },
  CLAIM_LIMITED: {
    subject: "Repeated account claim attempts blocked",
    what: "We blocked repeated attempts to claim your MEGS account.",
    sms: "Repeated attempts to claim your account were blocked.",
  },
  MFA_CHANGED: { subject: "Authenticator app changed", what: "The authenticator app on your MEGS account was changed or a change was attempted.", sms: "Your authenticator app was changed or a change was attempted." },
  PASSWORD_RESET: {
    subject: "Your password was reset",
    what: "The password of your MEGS account was reset.",
    sms: "Your account password was reset.",
  },
  PASSWORD_CHANGED: {
    subject: "Your password was changed",
    what: "The password of your MEGS account was changed.",
    sms: "Your account password was changed.",
  },
  MFA_RECOVERY_CODE_USED: {
    subject: "A recovery code was used",
    what: "A recovery code was used to sign in to your MEGS account.",
    sms: "A recovery code was used to sign in to your account.",
  },
  MFA_RESET_BY_ADMIN: {
    subject: "Two-step verification was reset",
    what: "An administrator reset two-step verification on your MEGS account.",
    sms: "An administrator reset two-step verification on your account.",
  },
};

const CREDENTIAL_EVENTS: SecurityEvent[] = ["MFA_CHANGED", "PASSWORD_RESET", "PASSWORD_CHANGED", "MFA_RECOVERY_CODE_USED", "MFA_RESET_BY_ADMIN"];

const timeFormat = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });

// Shows only the network part of the address: a.b.c.* or the first three IPv6 groups.
const maskIp = (ip: string): string => {
  const v4 = ip.replace(/^::ffff:/i, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) return `${v4.split(".").slice(0, 3).join(".")}.*`;
  return `${ip.split(":").slice(0, 3).join(":")}:*`;
};

export const notifySecurityEvent = async (
  target: { userId: string } | { identifier: string },
  event: SecurityEvent,
  ctx: { ip?: string; remainingCodes?: number } = {}
): Promise<void> => {
  try {
    const user = "userId" in target
      ? await prisma.user.findUnique({ where: { id: target.userId } })
      : await findUserByIdentifier(resolveAuthIdentifier(target.identifier));
    // A PENDING_VERIFICATION row is the registration in progress, not an existing account.
    if (!user || !user.isActive || user.accountStatus === "PENDING_VERIFICATION") return;

    const credential = CREDENTIAL_EVENTS.includes(event);
    if (!credential) {
      // shortcut: two blocked requests at the same instant can both pass this check; acceptable (one extra alert), add a unique key if it matters.
      const recent = await prisma.auditLog.findFirst({
        where: {
          userId: user.id,
          action: "SECURITY_ALERT_SENT",
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
          details: { contains: `"event":"${event}"` },
        },
        select: { id: true },
      });
      if (recent) return;
    }

    const copy = COPY[event];
    const closing = credential ? CREDENTIAL_CLOSING : SUSPICIOUS_CLOSING;
    const recoveryNote =
      event === "MFA_RECOVERY_CODE_USED" && ctx.remainingCodes !== undefined
        ? ` You have ${ctx.remainingCodes} recovery code${ctx.remainingCodes === 1 ? "" : "s"} left.`
        : "";
    const what = `${copy.what}${recoveryNote}`;
    const lines = [what, `Time: ${timeFormat.format(new Date())} (Manila)`];
    if (ctx.ip) lines.push(`From IP: ${maskIp(ctx.ip)}`);
    lines.push(closing);

    let channel: "email" | "sms";
    if (user.email && !isSyntheticEmail(user.email)) {
      const url = `${getAppBaseUrl()}/forgot-password`;
      await sendMail(
        user.email,
        copy.subject,
        `${lines.join("\n")}\n\nReset your password: ${url}`,
        renderBrandedEmail({
          heading: copy.subject,
          bodyHtml: lines.map((line) => `<p>${escapeHtml(line)}</p>`).join(""),
          preheader: what,
          cta: { text: "Reset your password", url },
          footnote: "MEGS never asks for your password or codes by email or text.",
        })
      );
      channel = "email";
    } else if (process.env.SMS_NOTIFICATIONS_ENABLED === "true") {
      const phone = await findSmsPhone(user.id);
      if (!phone) return;
      // Sent directly, not through the outbox: security texts skip quiet hours.
      const result = await sendSmsViaTextBee(phone, formatSms(`${copy.sms} ${closing}`));
      if (result.success === false) return;
      channel = "sms";
    } else {
      return;
    }

    await logAudit(user.id, "SECURITY_ALERT_SENT", "User", user.id, { event, channel });
  } catch (err) {
    console.error("[SECURITY ALERT]", err instanceof Error ? err.message : err);
  }
};

// Claim probe: alert only if the phone belongs to an active WALK_IN applicant.
export const notifyClaimProbe = async (phone: string, ip?: string): Promise<void> => {
  try {
    if (!isPhilippinePhone(phone)) return;
    const user = await findClaimableUser(normalizeToE164(phone));
    if (!user) return;
    await notifySecurityEvent({ userId: user.id }, "CLAIM_LIMITED", { ip });
  } catch (err) {
    console.error("[SECURITY ALERT]", err instanceof Error ? err.message : err);
  }
};
