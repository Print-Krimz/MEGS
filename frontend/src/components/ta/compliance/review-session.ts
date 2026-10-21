import { useState } from "react";
import type { RequirementReviewValues } from "../RequirementReviewDialog";
import type { Application, ComplianceRequirement } from "../../../lib/types";

export type ComplianceReviewMode = "pre" | "post";

/** Documents that still need action. Approved documents are done and are not listed. */
export const openRequirementsOf = (app?: Application | null): ComplianceRequirement[] =>
  (app?.complianceRequirements || []).filter((r) => r.reviewStatus !== "APPROVED");

/** Pre-employment opens on a submitted file first, then an empty one. Follow-ups open on the first open item. */
const startingRequirementId = (app: Application, mode: ComplianceReviewMode): number | null => {
  const open = openRequirementsOf(app);
  if (mode === "pre") {
    return (
      (open.find((r) => r.reviewStatus === "SUBMITTED") || open.find((r) => r.reviewStatus === "PENDING") || open[0])?.id ?? null
    );
  }
  return open[0]?.id ?? null;
};

/** Mirror a saved review onto the local copy so the dialog moves on without waiting for a refetch. */
export const applyReviewToApplication = (
  app: Application,
  requirementId: number,
  values: RequirementReviewValues
): Application => ({
  ...app,
  complianceRequirements: app.complianceRequirements?.map((r) =>
    r.id === requirementId
      ? {
          ...r,
          reviewStatus: values.reviewStatus,
          reviewNotes: values.reviewNotes ?? null,
          toFollowExpectedAt: values.toFollowExpectedAt ?? null,
          validityStatus: values.validityStatus ?? r.validityStatus,
          issuedAt: values.issuedAt !== undefined ? values.issuedAt : r.issuedAt,
          expiresAt: values.expiresAt !== undefined ? values.expiresAt : r.expiresAt,
          reviewedAt: new Date().toISOString(),
        }
      : r
  ),
});

/** Which application is open in the review dialog, and which document it starts on. */
export function useComplianceReviewSession(mode: ComplianceReviewMode) {
  const [application, setApplication] = useState<Application | null>(null);
  const [initialId, setInitialId] = useState<number | null>(null);
  // Bumping this remounts the dialog so its form reloads from the saved document.
  const [nonce, setNonce] = useState(0);

  const open = (app: Application) => {
    setApplication(app);
    setInitialId(startingRequirementId(app, mode));
    setNonce((n) => n + 1);
  };
  const close = () => setApplication(null);

  /** Call after a successful save. Approving moves to the next open document; the dialog closes when none are left. */
  const applySaved = (requirementId: number, values: RequirementReviewValues) => {
    if (!application) return;
    const updated = applyReviewToApplication(application, requirementId, values);
    const stillOpen = openRequirementsOf(updated);
    if (stillOpen.length === 0) {
      setApplication(null);
      return;
    }
    setApplication(updated);
    setInitialId(
      values.reviewStatus === "APPROVED" ? (stillOpen.find((r) => r.id !== requirementId) ?? stillOpen[0]).id : requirementId
    );
    setNonce((n) => n + 1);
  };

  return { application, initialId, nonce, open, close, applySaved };
}
