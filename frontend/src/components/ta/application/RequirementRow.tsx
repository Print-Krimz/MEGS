import React from "react";
import { CheckCircle2, Clock, FileText, ShieldCheck, XCircle } from "lucide-react";
import { ActionMenu } from "../../common";
import type { ActionMenuItem } from "../../common";
import { Button } from "../../ui";
import { cn, formatDate } from "../../../lib/utils";
import { plural } from "../../../lib/plural";
import { requirementStatusLabel } from "../../../lib/labels";

export interface RequirementRowData {
  id: number;
  documentLabel: string;
  documentId?: number | null;
  isRequired: boolean;
  reviewStatus: string;
  reviewNotes?: string | null;
  deadline?: string | null;
  toFollowExpectedAt?: string | null;
}

/** The one status a row shows. A document that is on file but not decided counts as submitted. */
const requirementRowStatus = (req: Pick<RequirementRowData, "reviewStatus" | "documentId">): string => {
  if (req.reviewStatus === "APPROVED" || req.reviewStatus === "REJECTED" || req.reviewStatus === "TO_FOLLOW") return req.reviewStatus;
  return req.documentId || req.reviewStatus === "SUBMITTED" ? "SUBMITTED" : "PENDING";
};

export interface RequirementRowProps {
  req: RequirementRowData;
  /** Removing is closed once the contract stage starts. */
  canRemove: boolean;
  onView: () => void;
  onReview: () => void;
  onRequestCopy: () => void;
  onEditDeadline: () => void;
  onRemove: () => void;
  onUpload?: () => void;
  /** False for walk-ins, who cannot upload for themselves. Defaults to true. */
  applicantHasPortalAccess?: boolean;
}

const STATUS_STYLE: Record<string, string> = {
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-900",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-900",
  TO_FOLLOW: "border-amber-200 bg-amber-50 text-amber-900",
  SUBMITTED: "border-navy-line bg-navy-soft text-navy",
  PENDING: "border-slate-200 bg-slate-100 text-slate-700",
};

export const RequirementRow: React.FC<RequirementRowProps> = ({ req, canRemove, onView, onReview, onRequestCopy, onEditDeadline, onRemove, onUpload, applicantHasPortalAccess = true }) => {
  const status = requirementRowStatus(req);
  const isApproved = status === "APPROVED";
  const isRejected = status === "REJECTED";
  const isToFollow = status === "TO_FOLLOW";
  const isSubmitted = status === "SUBMITTED";

  const now = new Date();
  const deadlineDate = req.deadline ? new Date(req.deadline) : null;
  const isOverdue = Boolean(deadlineDate && deadlineDate < now && !isApproved && !isToFollow);
  const diffDays = deadlineDate ? Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const isDueSoon = diffDays !== null && diffDays >= 0 && diffDays <= 3 && !isApproved && !isToFollow;

  // One primary control per row, chosen by state. Everything else lives in the row menu.
  const canUpload = Boolean(onUpload) && !isApproved;
  const uploadPrimary = canUpload && !applicantHasPortalAccess && !req.documentId && !isToFollow;
  const primary =
    uploadPrimary
      ? { label: "Upload document", onClick: onUpload! }
      : isApproved
      ? req.documentId ? { label: "View", onClick: onView } : null
      : isToFollow && !req.documentId
      ? { label: "Change target", onClick: onReview }
      : { label: "Review", onClick: onReview };

  const menu: ActionMenuItem[] = [];
  if (req.documentId && primary?.label !== "View") menu.push({ label: "View document", onSelect: onView });
  if (canUpload && !uploadPrimary) menu.push({ label: req.documentId ? "Replace document" : "Upload document", onSelect: onUpload! });
  // Upload takes the primary slot for a walk-in with nothing on file, so the follow-up decision moves into the menu.
  if (uploadPrimary) menu.push({ label: "Mark as to follow", onSelect: onReview });
  if (isApproved) menu.push({ label: "Request updated copy", onSelect: onRequestCopy });
  if (!isToFollow) menu.push({ label: deadlineDate ? "Edit deadline" : "Set deadline", onSelect: onEditDeadline });
  if (canRemove) menu.push({ label: "Remove requirement", onSelect: onRemove, tone: "danger" });

  const Icon = isApproved ? CheckCircle2 : isRejected ? XCircle : isToFollow || isSubmitted ? Clock : FileText;
  const iconColor = isApproved ? "text-emerald-700" : isRejected ? "text-rose-700" : isToFollow ? "text-amber-700" : isSubmitted ? "text-navy" : "text-slate-500";

  return (
    <div role="listitem" className={cn("flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between", (isDueSoon || isOverdue) && "bg-amber-50/30")}>
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconColor)} aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span id={`requirement-${req.id}-label`} className="text-sm font-semibold text-slate-900">{req.documentLabel}</span>
            <span className={cn("inline-flex rounded border px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[status])}>
              {requirementStatusLabel(status)}
            </span>
            {!req.isRequired && <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">Optional</span>}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-700">
            {/* A To follow item is tracked by its target date; the original submission deadline no longer applies. */}
            {isToFollow ? (
              <span className="font-medium text-amber-900">{req.toFollowExpectedAt ? `Target: ${formatDate(req.toFollowExpectedAt)}` : "No target date"}</span>
            ) : deadlineDate ? (
              <>
                <span>Deadline: {formatDate(req.deadline)}</span>
                {isOverdue && <span className="rounded border border-rose-300 bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-900">Overdue</span>}
                {isDueSoon && (
                  <span className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">
                    Due in {plural(diffDays ?? 0, "day")}
                  </span>
                )}
              </>
            ) : (
              <span className="text-slate-600">No deadline set</span>
            )}
            {isApproved && !req.documentId && <span className="text-emerald-800">Requirement approved</span>}
          </div>

          {req.reviewNotes && (
            <div className="space-y-0.5">
              <p className="text-xs italic text-slate-700">Review note: {req.reviewNotes}</p>
              {req.reviewNotes.includes("Carried over") && (
                <span className="inline-flex items-center gap-1 rounded border border-navy-line bg-navy-soft px-1.5 py-0.5 text-xs font-medium text-navy">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  Clearance carried over (12-month validity)
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0">
        {primary && (
          <Button variant="outline" size="sm" onClick={primary.onClick} aria-describedby={`requirement-${req.id}-label`}>
            {primary.label}
          </Button>
        )}
        {menu.length > 0 && <ActionMenu label={`More actions for ${req.documentLabel}`} items={menu} />}
      </div>
    </div>
  );
};
