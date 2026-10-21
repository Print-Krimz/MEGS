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
  onSubmit: (values: RequirementReviewValues, requirement: ReviewableRequirement) => void;
  isSubmitting: boolean;
  /** Right-hand text of each picker row. Defaults to the document status. */
  renderListMeta?: (requirement: ReviewableRequirement) => React.ReactNode;
}

/** The one review dialog for both compliance queues, with the inline file preview and the full-size viewer. */
export const ComplianceReviewDialog: React.FC<ComplianceReviewDialogProps> = ({
  session,
  mode,
  personName,
  onSubmit,
  isSubmitting,
  renderListMeta,
}) => {
  const { application } = session;
  const [viewer, setViewer] = useState<{ documentId: number; title: string } | null>(null);

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
