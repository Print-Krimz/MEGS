import { createHash } from "node:crypto";
import prisma from "../../utils/prisma.js";
import { sendNotification } from "../../utils/notification.js";
import { logAudit } from "../../utils/audit.js";
import { resolvePersonName } from "../../utils/user-name.js";
import { manilaDateString } from "../../schemas/field-limits.js";
import { JOB_OWNER_SELECT, jobOwnerTaId } from "../ta/ownership.js";

export interface RemindResult {
  /** Recruiters who now have the reminder (a repeat of the same reminder on the same day still counts). */
  reminded: number;
  /** Candidates that belong to one of those recruiters. */
  candidates: number;
  /** Ids that do not exist or have no recruiter (unassigned, or owned by an administrator). */
  skipped: number;
}

/** In-app reminder to each recruiter who owns the chosen overdue candidates. One message per recruiter, never email or SMS. */
export async function remindRecruiters(adminId: string, applicationIds: number[]): Promise<RemindResult> {
  const ids = [...new Set(applicationIds)];
  const [apps, admin] = await Promise.all([
    prisma.application.findMany({ where: { id: { in: ids } }, select: { id: true, jobPosting: { select: JOB_OWNER_SELECT } } }),
    prisma.user.findUnique({ where: { id: adminId }, select: { role: true, displayName: true, email: true } }),
  ]);
  const ownerOf = new Map(apps.map((a) => [a.id, jobOwnerTaId(a.jobPosting)]));
  const ownerIds = [...new Set([...ownerOf.values()].filter((id): id is string => id !== null))];
  const recruiters = ownerIds.length
    ? await prisma.user.findMany({ where: { id: { in: ownerIds }, role: "TALENT_ACQUISITION", isActive: true }, select: { id: true } })
    : [];
  const valid = new Set(recruiters.map((r) => r.id));

  const byRecruiter = new Map<string, number[]>();
  for (const [applicationId, owner] of ownerOf) {
    if (owner === null || !valid.has(owner)) continue;
    byRecruiter.set(owner, [...(byRecruiter.get(owner) ?? []), applicationId]);
  }

  // The reminder names the admin by name, never by email; the email stays in the audit entry below.
  const name = resolvePersonName(admin, "");
  const who = name ? `${name} (Admin)` : "An administrator";
  const day = manilaDateString();
  let reminded = 0;
  let candidates = 0;
  for (const [recruiterId, owned] of byRecruiter) {
    const sorted = owned.sort((a, b) => a - b);
    const hash = createHash("sha1").update(sorted.join(",")).digest("hex").slice(0, 12);
    const result = await sendNotification(
      recruiterId,
      "Overdue candidates",
      `${who} asked you to follow up on ${sorted.length} overdue candidate${sorted.length === 1 ? "" : "s"}.`,
      "WARNING",
      "/ta/analytics?tab=waiting",
      { dedupeKey: `admin-remind:${recruiterId}:${day}:${hash}` }
    );
    if (result === "sent" || result === "duplicate") {
      reminded++;
      candidates += sorted.length;
    }
  }
  const skipped = ids.length - candidates;
  void logAudit(adminId, "ANALYTICS_RECRUITERS_REMINDED", "Application", null, {
    applicationIds: ids,
    recruiters: reminded,
    candidates,
    skipped,
    actor: { id: adminId, name: name || null, role: admin?.role ?? "ADMINISTRATOR", email: admin?.email ?? null },
  });
  return { reminded, candidates, skipped };
}
