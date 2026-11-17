import { escapeHtml, getAppBaseUrl, renderBrandedEmail } from "./mailer.js";

export type JobAlertEmailJob = {
  id: number;
  title: string;
  location: string | null;
  reasons: string[];
  mrf: { location: string | null; salaryRangeMin: number | null; salaryRangeMax: number | null; client: { name: string } | null } | null;
};

const peso = (amount: number) => `PHP ${amount.toLocaleString("en-PH")}`;

const salaryText = (job: JobAlertEmailJob): string | null => {
  const min = job.mrf?.salaryRangeMin ?? 0;
  const max = job.mrf?.salaryRangeMax ?? 0;
  if (min > 0 && max > 0) return `${peso(min)} to ${peso(max)} a month`;
  if (max > 0) return `Up to ${peso(max)} a month`;
  if (min > 0) return `From ${peso(min)} a month`;
  return null;
};

const detailLine = (job: JobAlertEmailJob): string =>
  [job.mrf?.client?.name, job.location || job.mrf?.location, salaryText(job)].filter(Boolean).join(" · ");

/** The weekly/daily digest: up to five jobs, a plain reason for each, and a way to stop. */
export const buildJobAlertEmail = (params: { jobs: JobAlertEmailJob[]; unsubscribeUrl: string }) => {
  const base = getAppBaseUrl();
  const settingsUrl = `${base}/app/settings`;
  const count = params.jobs.length;
  const subject = count === 1 ? "1 new job matches your profile" : `${count} new jobs match your profile`;

  const jobsHtml = params.jobs
    .map(
      (job) => `
        <div style="margin: 0 0 18px 0; padding: 0 0 18px 0; border-bottom: 1px solid #E2E8F0;">
          <a href="${escapeHtml(`${base}/app/jobs/${job.id}`)}" style="font-size: 16px; font-weight: 700; color: #0F2A47; text-decoration: none;">${escapeHtml(job.title)}</a>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #475569;">${escapeHtml(detailLine(job))}</p>
          ${job.reasons.length ? `<p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 600; color: #0F2A47;">${escapeHtml(job.reasons.join(" · "))}</p>` : ""}
        </div>`,
    )
    .join("");

  const html = renderBrandedEmail({
    heading: subject,
    preheader: params.jobs.map((job) => job.title).join(", "),
    eyebrow: { text: "Jobs for you", color: "#0F2A47" },
    bodyHtml: `<p style="margin: 0 0 20px 0;">These open jobs fit your skills, experience and preferred work areas.</p>${jobsHtml}
      <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748B;">You get this email because job alerts are on for your MEGS account. <a href="${escapeHtml(settingsUrl)}" style="color: #0F2A47;">Change how often</a> or <a href="${escapeHtml(params.unsubscribeUrl)}" style="color: #0F2A47;">unsubscribe</a>.</p>`,
    cta: { text: "See all matches", url: `${base}/app/recommended` },
  });

  const text = [
    subject,
    "",
    ...params.jobs.flatMap((job) => [
      job.title,
      detailLine(job),
      ...(job.reasons.length ? [job.reasons.join(" · ")] : []),
      `${base}/app/jobs/${job.id}`,
      "",
    ]),
    `See all matches: ${base}/app/recommended`,
    "",
    `Change how often you get these emails: ${settingsUrl}`,
    `Unsubscribe: ${params.unsubscribeUrl}`,
  ].join("\n");

  return { subject, text, html };
};
