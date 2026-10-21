import React from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "../../../ui";
import { StatusBadge } from "../../../common";
import { formatTaStatus } from "../../../../lib/ta-copy";
import { plural } from "../../../../lib/plural";

interface MRFLinkedJobsTabProps {
  jobs: any[];
  readOnly: boolean;
  cancelled: boolean;
  onLinkExisting: () => void;
}

/** Job openings attached to the request. Creating one lives in the page header; linking an existing one is here. */
export const MRFLinkedJobsTab: React.FC<MRFLinkedJobsTabProps> = ({ jobs, readOnly, cancelled, onLinkExisting }) => (
  <section className="overflow-hidden rounded-md border border-slate-300 bg-white">
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
      <h3 className="text-base font-semibold text-slate-950">Job openings ({jobs.length})</h3>
      {!readOnly && (
        <Button variant="outline" size="sm" onClick={onLinkExisting}>
          Link existing
        </Button>
      )}
    </div>

    {jobs.length === 0 ? (
      <p className="p-6 text-sm text-slate-600">
        {readOnly || cancelled
          ? "No job openings are linked to this request."
          : "No job openings are linked to this request yet. Use Create job opening above, or link an existing one."}
      </p>
    ) : (
      <ul className="divide-y divide-slate-200">
        {jobs.map((job: any) => (
          <li key={job.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-950">{job.title}</span>
                <StatusBadge status={formatTaStatus(job.status)} type="raw" size="sm" />
                {job.isEvergreen && <span className="text-xs text-slate-600">Stays open after positions are filled</span>}
              </div>
              <p className="text-sm text-slate-600">
                {[
                  job.location || "Philippines",
                  job._count?.applications != null ? plural(job._count.applications, "applicant") : null,
                  readOnly ? `Job opening #${job.id}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {!readOnly && (
              <Button asChild variant="outline" size="sm">
                <Link to="/ta/jobs/$jobId" params={{ jobId: String(job.id) }}>
                  View opening
                </Link>
              </Button>
            )}
          </li>
        ))}
      </ul>
    )}
  </section>
);
