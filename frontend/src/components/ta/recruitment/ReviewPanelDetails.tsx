import React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Phone } from "lucide-react";
import { taApi } from "../../../lib/api/ta.api";
import { StatusBadge } from "../../common";
import { cn, formatDate } from "../../../lib/utils";
import { notify } from "../../../lib/feedback";
import { plural } from "../../../lib/plural";
import type { Application } from "../../../lib/types";
import type { WorkExperience, Education } from "../../../lib/types/applicant.types";
import type { TAApplicationSearch } from "../../../routes";
import type { ApplicationFlags } from "../application/stage-actions";

const MONTH_MS = 1000 * 60 * 60 * 24 * 30.44;

/** Years of work history with overlapping jobs counted once. Rounded to half years. */
export function totalExperienceYears(jobs: WorkExperience[], now = Date.now()): number | null {
  const spans = jobs
    .map((job) => {
      const start = Date.parse(job.startDate);
      const end = job.isCurrent || !job.endDate ? now : Date.parse(job.endDate);
      return Number.isFinite(start) && Number.isFinite(end) && end > start ? [start, end] : null;
    })
    .filter((span): span is number[] => span !== null)
    .sort((a, b) => a[0] - b[0]);
  if (spans.length === 0) return null;
  let total = 0;
  let [curStart, curEnd] = spans[0];
  for (const [start, end] of spans.slice(1)) {
    if (start <= curEnd) curEnd = Math.max(curEnd, end);
    else {
      total += curEnd - curStart;
      [curStart, curEnd] = [start, end];
    }
  }
  total += curEnd - curStart;
  return Math.round((total / MONTH_MS / 12) * 2) / 2;
}

const yearsLabel = (years: number) => (years < 1 ? "Under 1 year" : `${years} ${years === 1 ? "year" : "years"}`);

const monthYear = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-PH", { month: "short", year: "numeric", timeZone: "Asia/Manila" }) : "";

const jobLine = (job: WorkExperience) => {
  const end = job.isCurrent || !job.endDate ? "present" : monthYear(job.endDate);
  return `${job.roleTitle} · ${job.company} · ${monthYear(job.startDate)} to ${end}`;
};

const educationLine = (education: Education) =>
  [education.degree, education.fieldOfStudy].filter(Boolean).join(", ") + (education.degree || education.fieldOfStudy ? " · " : "") + education.school;

const Fact: React.FC<{ label: string; children: React.ReactNode; wide?: boolean }> = ({ label, children, wide }) => (
  <div className={cn("min-w-0", wide && "col-span-2")}>
    <dt className="text-slate-600">{label}</dt>
    <dd className="mt-0.5 break-words text-slate-900">{children}</dd>
  </div>
);

const SectionHeading: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => (
  <h3 id={id} className="border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">
    {children}
  </h3>
);

/** Mobile number as a call link, plus a copy button for desktop recruiters who dial from a phone. */
const MobileValue: React.FC<{ mobile: string }> = ({ mobile }) => (
  <span className="inline-flex flex-wrap items-center gap-1">
    <a href={`tel:${mobile.replace(/\s+/g, "")}`} className="inline-flex min-h-11 items-center gap-1 font-medium text-navy underline underline-offset-2 focus-ring md:min-h-0">
      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
      {mobile}
    </a>
    <button
      type="button"
      aria-label={`Copy ${mobile}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(mobile);
          notify.success("Number copied", mobile);
        } catch {
          notify.error("Unable to copy the number", "Copy it from the record instead.");
        }
      }}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-ring md:min-h-7 md:min-w-7"
    >
      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  </span>
);

/** Who the candidate is, from the profile: place, experience, latest job, schooling, skills and contact. */
export const CandidateSnapshot: React.FC<{ app: Application; email?: string | null; matchedSkills?: string[] }> = ({
  app,
  email,
  matchedSkills = [],
}) => {
  const profile = app.user?.applicantProfile;
  const jobs = profile?.workExperiences ?? [];
  const years = totalExperienceYears(jobs);
  const latestJob = jobs[0];
  const education = profile?.educations?.[0];
  const skills = (profile?.skills ?? []).map((skill) => (typeof skill === "string" ? skill : skill.name)).filter(Boolean);
  const matched = new Set(matchedSkills.map((skill) => skill.toLowerCase()));
  // Skills the job asks for come first so the recruiter sees the fit before the rest.
  const shownSkills = [...skills].sort((a, b) => Number(matched.has(b.toLowerCase())) - Number(matched.has(a.toLowerCase()))).slice(0, 8);
  const place = [profile?.city, profile?.province].filter(Boolean).join(", ");

  return (
    <section aria-labelledby="review-candidate-heading" className="space-y-3">
      <SectionHeading id="review-candidate-heading">Candidate</SectionHeading>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {place && <Fact label="Lives in">{place}</Fact>}
        <Fact label="Experience">{years == null ? "No work history" : yearsLabel(years)}</Fact>
        {latestJob && <Fact label={latestJob.isCurrent ? "Current job" : "Latest job"} wide>{jobLine(latestJob)}</Fact>}
        {education && <Fact label="Education" wide>{educationLine(education)}</Fact>}
        {profile?.mobileNumber && <Fact label="Mobile"><MobileValue mobile={profile.mobileNumber} /></Fact>}
        {email && <Fact label="Email"><span className="break-all">{email}</span></Fact>}
      </dl>
      {shownSkills.length > 0 && (
        <div>
          <p className="text-sm text-slate-600">Skills</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Skills">
            {shownSkills.map((skill) => {
              const isMatch = matched.has(skill.toLowerCase());
              return (
                <li
                  key={skill}
                  className={cn(
                    "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium",
                    isMatch ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-300 bg-white text-slate-700"
                  )}
                >
                  {isMatch && <Check className="h-3 w-3" aria-hidden="true" />}
                  {skill}
                  {isMatch && <span className="sr-only">(the job asks for this)</span>}
                </li>
              );
            })}
            {skills.length > shownSkills.length && (
              <li className="px-1 py-0.5 text-xs text-slate-600">+{skills.length - shownSkills.length} more</li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
};

const CLIENT_OUTCOME: Record<string, string> = {
  PENDING: "Waiting for the client",
  APPROVED: "Approved",
  ENDORSED: "Approved",
  DECLINED: "Declined",
};

/** Where the application stands: time in stage, interviews, client review and requirements. */
export const HiringProgress: React.FC<{ app: Application; flags: ApplicationFlags; daysText: string; limitDays?: number }> = ({
  app,
  flags,
  daysText,
  limitDays,
}) => {
  const endorsement = flags.latestEndorsement;
  return (
    <section aria-labelledby="review-progress-heading" className="space-y-3">
      <SectionHeading id="review-progress-heading">Progress</SectionHeading>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Fact label="In stage">
          {daysText}
          {limitDays ? <span className="text-slate-600"> (limit {limitDays} days)</span> : null}
        </Fact>
        <Fact label="Applied">{formatDate(app.createdAt)}</Fact>
        {endorsement && (
          <Fact label="Client review">
            {CLIENT_OUTCOME[endorsement.outcome] ?? endorsement.outcome}
            {endorsement.createdAt ? <span className="text-slate-600"> · sent {formatDate(endorsement.createdAt)}</span> : null}
          </Fact>
        )}
        {flags.totalCompReqs > 0 && (
          <Fact label="Requirements">
            {flags.approvedCompReqs} of {plural(flags.totalCompReqs, "document")} approved
            {flags.submittedCompReqs > 0 ? <span className="text-slate-600"> · {flags.submittedCompReqs} to review</span> : null}
          </Fact>
        )}
      </dl>
    </section>
  );
};

/**
 * The candidate's other applications that this recruiter can see. The list endpoint is already
 * owner-scoped, so searching by the mobile number (or email) and keeping the same account is enough.
 */
export const OtherApplications: React.FC<{ app: Application; email?: string | null; listSearch: TAApplicationSearch }> = ({
  app,
  email,
  listSearch,
}) => {
  const userId = app.user?.id;
  const term = app.user?.applicantProfile?.mobileNumber || email || "";
  const query = useQuery({
    queryKey: ["ta", "applications", "same-candidate", userId, term],
    queryFn: ({ signal }) => taApi.listApplicationsPage({ page: 1, limit: 25, search: term, summary: true }, { signal }),
    enabled: Boolean(userId && term),
    staleTime: 30_000,
  });
  const others = (query.data?.items ?? []).filter((row) => row.user?.id === userId && row.id !== app.id);
  if (others.length === 0) return null;

  return (
    <section aria-labelledby="review-others-heading" className="space-y-3">
      <SectionHeading id="review-others-heading">Other applications ({others.length})</SectionHeading>
      <ul className="divide-y divide-slate-200 rounded-md border border-slate-300">
        {others.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <Link
              to="/ta/applications/$applicationId"
              params={{ applicationId: String(row.id) }}
              search={listSearch}
              className="min-w-0 font-medium text-navy underline underline-offset-2 focus-ring"
            >
              {row.jobPosting?.title || "Job opening"}
              {row.jobPosting?.mrf?.client?.name ? ` · ${row.jobPosting.mrf.client.name}` : ""}
            </Link>
            <span className="flex items-center gap-2">
              <span className="text-xs text-slate-600">{formatDate(row.createdAt)}</span>
              <StatusBadge status={row.isArchived ? "ARCHIVED" : row.status} size="sm" />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};
