import React from "react";
import { ActionMenu, PageHeader, ScoreBadge } from "../../common";
import type { ActionMenuItem } from "../../common";
import { formatDate } from "../../../lib/utils";
import { TA_COPY } from "../../../lib/ta-copy";

export interface CaseHeaderProps {
  candidateName: string;
  applicationId: number;
  jobTitle?: string | null;
  email?: string | null;
  mobileNumber?: string | null;
  submittedAt?: string | null;
  score?: number | string | null;
  /** The list URL with the filters the recruiter came from. */
  listHref: string;
  menuItems: ActionMenuItem[];
}

/** Breadcrumb, name, one line of context and the rare actions in a "More" menu. No Back button: the breadcrumb is the way back. */
export const CaseHeader: React.FC<CaseHeaderProps> = ({
  candidateName,
  applicationId,
  jobTitle,
  email,
  mobileNumber,
  submittedAt,
  score,
  listHref,
  menuItems,
}) => (
  <PageHeader
    flush
    title={candidateName}
    meta={score !== undefined && score !== null && score !== "" ? <ScoreBadge score={score} size="md" /> : undefined}
    description={
      <>
        <span className="block">{`${jobTitle || "Job opening not specified"} · Application #${applicationId}`}</span>
        <span className="block text-slate-600">
          {[email, mobileNumber, submittedAt ? `Submitted ${formatDate(submittedAt)}` : null].filter(Boolean).join(" · ")}
        </span>
      </>
    }
    breadcrumbs={[
      { label: TA_COPY.navigation.overview, href: "/ta" },
      { label: TA_COPY.navigation.applications, href: listHref },
      { label: candidateName },
    ]}
    actions={menuItems.length > 0 ? <ActionMenu label="More actions" items={menuItems} /> : undefined}
  />
);
