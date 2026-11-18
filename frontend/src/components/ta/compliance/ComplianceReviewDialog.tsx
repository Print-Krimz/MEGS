import React, { useState } from "react";
import { DocumentPreviewModal } from "../../common";
import {
  RequirementReviewDialog,
  type RequirementReviewValues,
  type ReviewableRequirement,
} from "../RequirementReviewDialog";
import { RequirementDocumentPreview } from "./RequirementDocumentPreview";
import { openRequirementsOf, type ComplianceReviewMode, type useComplianceReviewSession } from "./review-session";
import type { Application } from "../../../lib/types";

export interface ComplianceReviewDialogProps {
  session: ReturnType<typeof useComplianceReviewSession>;
  mode: ComplianceReviewMode;
  personName: (app: Application) => string;
  onSubmit: (
    values: RequirementReviewValues,
    requirement: ReviewableRequirement,
    options?: { advanceToContractSigning?: boolean }
  ) => void;
  isSubmitting: boolean;
  /** Right-hand text of each picker row. Defaults to the document status. */
  renderListMeta?: (requirement: ReviewableRequirement) => React.ReactNode;
  /** Client medical validity in months for auto-calculating medical expiry preview. */
  medicalValidityMonths?: number;
  /** Offer a checked-by-default toggle to move the candidate to Contract Signing when the last mandatory doc clears. */
  canAutoAdvanceToContractSigning?: boolean;
}

/** The one review dialog for both compliance queues, with the inline file preview and the full-size viewer. */
export const ComplianceReviewDialog: React.FC<ComplianceReviewDialogProps> = ({
  session,
  mode,
  personName,
  onSubmit,
  isSubmitting,
  renderListMeta,
  medicalValidityMonths,
  canAutoAdvanceToContractSigning = false,
}) => {
  const { application } = session;
  const [viewer, setViewer] = useState<{ documentId: number; title: string } | null>(null);
  const remainingMandatoryCount = (application?.complianceRequirements || []).filter(
    (r) => r.isRequired !== false && r.reviewStatus !== "APPROVED" && r.reviewStatus !== "TO_FOLLOW"
  ).length;

  return (
    <>
      <RequirementReviewDialog
        key={session.nonce}
        open={Boolean(application)}
        onClose={session.close}
        title="Review documents"
        subtitle={
          application ? `${personName(application)} · ${application.jobPosting?.title || "Job opening"}` : undefined
        }
        mode={mode}
        requirements={openRequirementsOf(application)}
        initialRequirementId={session.initialId}
        renderListMeta={renderListMeta}
        medicalValidityMonths={medicalValidityMonths}
        canAutoAdvanceToContractSigning={canAutoAdvanceToContractSigning}
        remainingMandatoryCount={remainingMandatoryCount}
        renderDocumentPreview={(req) =>
          req.documentId ? (
            <RequirementDocumentPreview
              documentId={req.documentId}
              documentLabel={req.documentLabel}
              onExpand={() => setViewer({ documentId: req.documentId as number, title: req.documentLabel })}
            />
          ) : null
        }
        isSubmitting={isSubmitting}
        onSubmit={onSubmit}
      />
      <DocumentPreviewModal
        open={Boolean(viewer)}
        onClose={() => setViewer(null)}
        documentId={viewer?.documentId}
        title={viewer?.title || "Document preview"}
        applicantName={application ? personName(application) : undefined}
      />
    </>
  );
};
