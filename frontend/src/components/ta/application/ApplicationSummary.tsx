import React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { ActionMenu, RecordSummary, ScoreBadge, StatusBadge } from "../../common";
import type { ActionMenuItem } from "../../common";
import { formatDate, cn } from "../../../lib/utils";
import { plural } from "../../../lib/plural";
import { TA_COPY, TA_STATUS_TONE_CLASSES } from "../../../lib/ta-copy";

export interface ApplicationSummaryProps {
  candidateName: string;
  candidateInitials: string;
  applicationId: number;
  jobId?: string | number | null;
  jobTitle?: string | null;
  email?: string | null;
  mobileNumber?: string | null;
  city?: string | null;
  submittedAt?: string | null;
  daysInStage: number;
  /** Latest interview result, or the date of the next one. */
  interviewText: string;
  score?: number | string | null;
  status: string;
  /** Set when the application is deployed but the worker has not started yet. The chip then says "Contract signed". */
  contractSignedOnly?: boolean;
  /** The list URL with the filters the recruiter came from. */
  listHref: string;
  menuItems: ActionMenuItem[];
  /** "View resume" button, shown when the resume is not a side column. */
  resumeAction?: React.ReactNode;
  /** The stage stepper. */
  stepper?: React.ReactNode;
}

/** Lets a long address wrap before the @ instead of in the middle of a word. */
const EmailValue: React.FC<{ email: string }> = ({ email }) => {
  const at = email.indexOf("@");
  return at < 1 ? <>{email}</> : (
    <>
      {email.slice(0, at)}
      <wbr />
      {email.slice(at)}
    </>
  );
};

/** Breadcrumb, then one summary card: who, how they score, where they are, and the facts a recruiter looks up. */
export const ApplicationSummary: React.FC<ApplicationSummaryProps> = ({
  candidateName,
  candidateInitials,
  applicationId,
  jobId,
  jobTitle,
  email,
  mobileNumber,
  city,
  submittedAt,
  daysInStage,
  interviewText,
  score,
  status,
  contractSignedOnly,
  listHref,
  menuItems,
  resumeAction,
  stepper,
}) => {
  const hasScore = score !== undefined && score !== null && score !== "";
  return (
    <div className="space-y-2">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-1.5 text-sm text-slate-600">
        <Link to="/ta" className="inline-flex min-h-11 items-center hover:text-slate-900 md:min-h-0 md:py-0.5">
          {TA_COPY.navigation.overview}
        </Link>
        <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
        <Link to={listHref} className="inline-flex min-h-11 items-center hover:text-slate-900 md:min-h-0 md:py-0.5">
          {TA_COPY.navigation.applications}
        </Link>
        <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
        <span aria-current="page" className="min-w-0 max-w-[200px] truncate font-semibold text-slate-900 sm:max-w-[320px]">
          {candidateName}
        </span>
      </nav>

      <RecordSummary
        title={candidateName}
        titleAs="h1"
        subtitle={`Application #${applicationId}`}
        avatarText={candidateInitials}
        chips={
          <>
            {hasScore && <ScoreBadge score={score} size="lg" />}
            {contractSignedOnly ? (
              <span className={cn("inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold", TA_STATUS_TONE_CLASSES.info)}>Contract signed</span>
            ) : (
              <StatusBadge status={status} size="md" />
            )}
          </>
        }
        facts={[
          { label: "Email", value: email ? <EmailValue email={email} /> : "Not provided", copyValue: email || undefined, href: email ? `mailto:${email}` : undefined },
          {
            label: "Mobile",
            value: <span className="tabular-nums">{mobileNumber || "Not provided"}</span>,
            copyValue: mobileNumber || undefined,
            href: mobileNumber ? `tel:${mobileNumber}` : undefined,
          },
          { label: "City", value: city || "Not provided" },
          {
            label: "Applied for",
            value: jobTitle || "Job opening not specified",
            href: jobId !== undefined && jobId !== null && jobTitle ? `/ta/jobs/${jobId}` : undefined,
          },
          {
            label: "Submitted",
            value: (
              <>
                {formatDate(submittedAt)}
                <span className="text-slate-600"> · {plural(daysInStage, "day")} in stage</span>
              </>
            ),
          },
          { label: "Interview", value: interviewText },
        ]}
        actions={
          <>
            {resumeAction}
            {menuItems.length > 0 && <ActionMenu label="More actions" items={menuItems} />}
          </>
        }
      >
        {stepper}
      </RecordSummary>
    </div>
  );
};
