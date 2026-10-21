import React from "react";
import { Button } from "../../../ui";
import { StatusBadge } from "../../../common";
import { cn, formatDate } from "../../../../lib/utils";
import { addManilaCalendarDays, getManilaToday } from "../../../../lib/field-limits";
import { calculateUrgencyStatus } from "../../../../lib/compliance-queue";
import { TA_STATUS_TONE_CLASSES, getTaStatusTone } from "../../../../lib/ta-copy";
import { requirementStatusLabel } from "../../../../lib/labels";

export const SECTION_HEADING = "text-lg font-semibold text-slate-950";

/** One requirement row in the clearance vault. The loose shape matches the employee record payload. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type VaultRequirement = any;

export const DetailField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-0.5">
    <dt className="text-xs font-medium text-slate-600">{label}</dt>
    <dd className="break-words text-sm text-slate-900">{children}</dd>
  </div>
);

/** One requirement status chip in the vault, worded by requirementStatusLabel. */
export const RequirementBadge: React.FC<{ status?: string | null }> = ({ status }) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium",
      TA_STATUS_TONE_CLASSES[getTaStatusTone(status)],
    )}
  >
    {requirementStatusLabel(status)}
  </span>
);

export const FollowUpTarget: React.FC<{ req: VaultRequirement }> = ({ req }) => {
  const targetDate = req.updateRequestDeadline || req.toFollowExpectedAt || req.deadline;
  if (!targetDate) return <span>—</span>;
  const urgency = calculateUrgencyStatus(targetDate);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span>{formatDate(targetDate)}</span>
      {urgency.category === "OVERDUE" && (
        <span className="rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-800">
          {urgency.label}
        </span>
      )}
      {urgency.category === "UPCOMING" && (
        <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
          {urgency.label}
        </span>
      )}
    </span>
  );
};

export const ValidityDates: React.FC<{ req: VaultRequirement }> = ({ req }) => (
  <div className="text-sm text-slate-700">
    {req.issuedAt && <div>Issued: {formatDate(req.issuedAt)}</div>}
    {req.expiresAt && <div>Expires: {formatDate(req.expiresAt)}</div>}
    {!req.issuedAt && !req.expiresAt && <span className="text-slate-600">Not recorded</span>}
  </div>
);

export const ValidityBadge: React.FC<{ req: VaultRequirement }> = ({ req }) =>
  req.expiresAt && req.expiresAt.slice(0, 10) < getManilaToday() ? (
    <StatusBadge status="Expired" type="raw" size="sm" />
  ) : req.expiresAt && req.expiresAt.slice(0, 10) <= addManilaCalendarDays(getManilaToday(), 30) ? (
    <StatusBadge status="Expiring soon" type="raw" size="sm" />
  ) : req.validityStatus === "UNKNOWN" && !req.expiresAt ? (
    <StatusBadge status="Validity unrecorded" type="raw" size="sm" />
  ) : req.validityStatus === "NO_EXPIRY" ? (
    <StatusBadge status="No expiry" type="raw" size="sm" />
  ) : (
    <StatusBadge status="Approved" type="raw" size="sm" />
  );

export const DocumentVersions: React.FC<{ req: VaultRequirement; onPreview: (doc: { id: number; title: string }) => void }> = ({
  req,
  onPreview,
}) =>
  req.documentVersions?.length > 1 ? (
    <details className="mt-1 text-sm">
      <summary className="focus-ring inline-flex min-h-11 cursor-pointer items-center text-navy hover:underline md:min-h-0">
        {req.documentVersions.length} versions
      </summary>
      <div className="mt-1.5 space-y-1.5 border-l border-navy-line pl-2">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {req.documentVersions.map((version: any) => (
          <div key={version.id} className="flex items-center justify-between gap-2 text-slate-700">
            <span>Uploaded {formatDate(version.uploadedAt)} · {requirementStatusLabel(version.reviewStatus)}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPreview({ id: version.documentId, title: `${req.documentLabel} (${formatDate(version.uploadedAt)})` })}
            >
              View
            </Button>
          </div>
        ))}
      </div>
    </details>
  ) : null;
