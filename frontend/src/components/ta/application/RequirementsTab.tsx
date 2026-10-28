import React, { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "../../ui";
import { ClientReviewSummary, type ClientReviewSummaryProps } from "./ClientReviewSummary";
import { BulkUploadRequirementsDialog, canTakeUpload } from "./BulkUploadRequirementsDialog";
import { UploadRequirementDialog } from "./UploadRequirementDialog";
import { RequirementRow, type RequirementRowData } from "./RequirementRow";

export interface RequirementsTabProps {
  clientReview: ClientReviewSummaryProps;
  isDeployed: boolean;
  requirements: RequirementRowData[];
  counts: { total: number; approved: number; toFollow: number; submitted: number; missing: number };
  isAllApproved: boolean;
  /** Requirements are managed only from the Requirements stage onward. */
  canManage: boolean;
  /** Removing is closed once the contract stage starts. */
  canRemove: boolean;
  onAdd: () => void;
  onView: (req: RequirementRowData) => void;
  onReview: (req: RequirementRowData) => void;
  onRequestCopy: (req: RequirementRowData) => void;
  onEditDeadline: (req: RequirementRowData) => void;
  onRemove: (req: RequirementRowData) => void;
  /** Needed to refresh the record after a TA upload. */
  applicationId: string;
  /** Walk-ins have none, so the recruiter uploads for them. */
  applicantHasPortalAccess?: boolean;
  /** Contract signing opens once requirements are approved. Before that the section is one line. */
  showReadiness: boolean;
  /** Contract and deployment steps (the readiness list). */
  readiness: React.ReactNode;
}

/** Client review in one row, then the checklist, then the contract and deployment steps. */
export const RequirementsTab: React.FC<RequirementsTabProps> = ({
  clientReview,
  isDeployed,
  requirements,
  counts,
  isAllApproved,
  canManage,
  canRemove,
  onAdd,
  onView,
  onReview,
  onRequestCopy,
  onEditDeadline,
  onRemove,
  applicationId,
  applicantHasPortalAccess = true,
  showReadiness,
  readiness,
}) => {
  // The list opens while work remains and folds away once everything is approved; the recruiter can override it.
  const [uploadTarget, setUploadTarget] = useState<RequirementRowData | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  // Documents just uploaded in bulk, kept so the recruiter can approve them without hunting through the list.
  const [verifyIds, setVerifyIds] = useState<number[]>([]);
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  // Before compliance a waiting decision is already the stage bar's action, so the row would only repeat it.
  const hideClientReview = (Boolean(clientReview.notRequired) && clientReview.endorsements.length === 0) ||
    (Boolean(clientReview.stageBarOwnsDecision) && !clientReview.isPastClientReview && clientReview.endorsements.length <= 1);
  const toVerify = !canManage ? [] : requirements.filter((r) => verifyIds.includes(r.id) && r.documentId && r.reviewStatus !== "APPROVED" && r.reviewStatus !== "REJECTED");
  const canBulkUpload = canManage && requirements.filter(canTakeUpload).length > 1;
  // A closed application that reached Requirements keeps its list and contract steps; one that never did has neither.
  const showContractSection = canManage || requirements.length > 0;
  const expanded = manualExpanded !== null ? manualExpanded : !isAllApproved;

  return (
    <div className="space-y-8">
      {!hideClientReview && <ClientReviewSummary {...clientReview} />}

      <section id="compliance-checklist-section" aria-labelledby="requirements-heading" className="space-y-3">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center">
          <div className="space-y-0.5">
            <h3 id="requirements-heading" className="text-base font-semibold text-slate-900">
              Requirements
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
          {canBulkUpload && (
            <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => setBulkOpen(true)}>
              Upload several
            </Button>
          )}
          {canManage && (
            <Button variant="outline" size="sm" className="whitespace-nowrap" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={onAdd}>
              Add requirement
            </Button>
          )}
          </div>
        </div>

        {toVerify.length > 0 && (
          <div role="region" aria-label="Quick verification" className="space-y-2 border border-navy-line bg-navy-soft p-3">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <p className="text-sm font-semibold text-slate-900">{toVerify.length} uploaded {toVerify.length === 1 ? "document" : "documents"} to review</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setVerifyIds([])}>Dismiss</Button>
                <Button variant="primary" size="sm" onClick={() => onReview(toVerify[0]!)}>Review next</Button>
              </div>
            </div>
            <ul className="divide-y divide-navy-line text-sm">
              {toVerify.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0 truncate text-slate-900">{r.documentLabel}</span>
                  <Button variant="outline" size="sm" onClick={() => onReview(r)} aria-label={`Review ${r.documentLabel}`}>Review</Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {requirements.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 py-8 text-center text-sm text-slate-600">
            {canManage
              ? "No requirements yet. The standard checklist is created when the candidate moves to requirements."
              : "Requirements open when the candidate reaches the Requirements stage. The standard checklist is created then."}
          </div>
        ) : (
          <>
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <p className="text-sm text-slate-800">
                <span className="font-semibold">
                  {isAllApproved && counts.toFollow === 0 ? `All ${counts.total} requirements approved` : `${counts.approved} of ${counts.total} approved`}
                </span>
                {!isAllApproved && (
                  <span className="text-slate-700">
                    {" "}
                    · {counts.submitted} to review · {counts.missing} not submitted
                    {counts.toFollow > 0 && ` · ${counts.toFollow} to follow`}
                  </span>
                )}
                {isDeployed && counts.total - counts.approved > 0 && (
                  <span className="text-slate-700"> · {counts.total - counts.approved} to follow up</span>
                )}
              </p>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls="requirements-list"
                onClick={() => setManualExpanded(!expanded)}
                className="focus-ring inline-flex min-h-11 items-center self-start px-1 text-sm font-medium text-navy underline-offset-2 hover:underline md:min-h-6"
              >
                {expanded ? `Hide requirements (${counts.total})` : `Show requirements (${counts.total})`}
              </button>
            </div>

            {expanded && (
              <div id="requirements-list" role="list" className="divide-y divide-slate-100 border border-slate-200">
                {requirements.map((req) => (
                  <RequirementRow
                    key={req.id}
                    req={req}
                    canRemove={canManage && canRemove}
                    readOnly={!canManage}
                    onView={() => onView(req)}
                    onReview={() => onReview(req)}
                    onRequestCopy={() => onRequestCopy(req)}
                    onEditDeadline={() => onEditDeadline(req)}
                    onRemove={() => onRemove(req)}
                    onUpload={() => setUploadTarget(req)}
                    applicantHasPortalAccess={applicantHasPortalAccess}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {showContractSection && (
      <section id="compliance-onboarding-section" aria-labelledby="contract-heading" className="space-y-3">
        <div className="border-b border-slate-200 pb-3">
          <h3 id="contract-heading" className="text-base font-semibold text-slate-900">
            Contract signing & deployment
          </h3>
          <p className="text-sm text-slate-600">
            {isDeployed
              ? "Deployment record."
              : showReadiness
              ? "Prepare the MEGS contract, upload the signed copy, and confirm the employee’s first day on site."
              : "Contract signing opens after requirements are approved."}
          </p>
        </div>
        {showReadiness && readiness}
      </section>
      )}

      {bulkOpen && (
        <BulkUploadRequirementsDialog
          applicationId={applicationId}
          requirements={requirements}
          onClose={() => setBulkOpen(false)}
          onUploaded={(ids) => setVerifyIds(ids)}
          onReviewNow={(id) => {
            setBulkOpen(false);
            const target = requirements.find((r) => r.id === id);
            if (target) onReview(target);
          }}
        />
      )}

      {uploadTarget && (
        <UploadRequirementDialog applicationId={applicationId} requirement={uploadTarget} onClose={() => setUploadTarget(null)} />
      )}
    </div>
  );
};
