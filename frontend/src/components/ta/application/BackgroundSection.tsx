import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn, formatDate } from "../../../lib/utils";
import { formatTaStatus } from "../../../lib/ta-copy";
import { plural } from "../../../lib/plural";

export interface BackgroundSectionProps {
  profile: any;
  jobPosting?: { title?: string | null; location?: string | null; status?: string | null } | null;
}

/** Job opening, employment, education and skills in one collapsible block, closed until the recruiter wants the detail. */
export const BackgroundSection: React.FC<BackgroundSectionProps> = ({ profile, jobPosting }) => {
  const [open, setOpen] = useState(false);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const jobs: any[] = profile?.workExperiences ?? [];
  const schools: any[] = profile?.educations ?? [];
  const skills: any[] = profile?.skills ?? [];
  const shownSkills = showAllSkills ? skills : skills.slice(0, 8);

  return (
    <section aria-labelledby="background-heading" className="border border-slate-300 bg-white">
      <h3 id="background-heading" className="text-base font-semibold text-slate-900">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="background-body"
          onClick={() => setOpen((v) => !v)}
          className="focus-ring-inset flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
        >
          <span>
            Background
            <span className="ml-2 text-sm font-normal text-slate-600">
              {plural(jobs.length, "job")} · {plural(schools.length, "education entry", "education entries")} · {plural(skills.length, "skill")}
            </span>
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-600 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
        </button>
      </h3>

      {open && (
        <div id="background-body" className="space-y-5 border-t border-slate-200 p-4 text-sm">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-800">Job opening</h4>
            <dl className="space-y-1">
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <dt className="text-slate-600">Position</dt>
                <dd className="font-semibold text-slate-900">{jobPosting?.title || "Not specified"}</dd>
              </div>
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <dt className="text-slate-600">Location</dt>
                <dd className="text-slate-900">{jobPosting?.location || "Philippines"}</dd>
              </div>
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <dt className="text-slate-600">Opening status</dt>
                <dd className="text-slate-900">{formatTaStatus(jobPosting?.status || "OPEN")}</dd>
              </div>
            </dl>
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-4">
            <h4 className="text-sm font-semibold text-slate-800">Employment history</h4>
            {jobs.length === 0 ? (
              <p className="text-slate-600">No recorded employment entries.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {jobs.map((exp) => (
                  <div key={exp.id} className="py-2">
                    <span className="font-semibold text-slate-900">{exp.roleTitle}</span> at <span className="font-medium text-slate-800">{exp.company}</span>
                    <div className="text-xs tabular-nums text-slate-600">
                      {formatDate(exp.startDate)} — {exp.isCurrent ? "Present" : exp.endDate ? formatDate(exp.endDate) : "N/A"}
                    </div>
                    {exp.summary && <p className="mt-1 text-slate-700">{exp.summary}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-4">
            <h4 className="text-sm font-semibold text-slate-800">Education</h4>
            {schools.length === 0 ? (
              <p className="text-slate-600">No education entries on file.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {schools.map((edu) => (
                  <div key={edu.id} className="py-2">
                    <span className="font-semibold text-slate-900">{edu.degree}</span> · {edu.school}
                    {edu.fieldOfStudy && <div className="text-xs text-slate-600">{edu.fieldOfStudy}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-slate-800">Skills</h4>
              {skills.length > 8 && (
                <button type="button" onClick={() => setShowAllSkills((v) => !v)} className="focus-ring inline-flex min-h-11 items-center px-1 text-sm font-medium text-navy hover:underline md:min-h-6">
                  {showAllSkills ? "Show top 8" : `View all (${skills.length})`}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {skills.length > 0 ? (
                shownSkills.map((s, idx) => (
                  <span key={idx} className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
                    {typeof s === "string" ? s : s.name}
                  </span>
                ))
              ) : (
                <span className="text-slate-600">No skills listed</span>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
