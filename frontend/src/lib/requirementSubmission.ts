interface DocumentVersionDates {
  uploadedAt: string;
  isCurrent: boolean;
}

/**
 * When the requirement's document was submitted, and whether it is a resubmission.
 * Versions arrive newest first. A version that is no longer current means the document was replaced.
 */
export const requirementSubmission = (versions: DocumentVersionDates[] | undefined, status: string) => {
  const list = versions ?? [];
  const latest = list.find((v) => v.isCurrent) ?? list[0];
  return {
    submittedAt: latest?.uploadedAt ?? null,
    resubmitted: status === "SUBMITTED" && list.some((v) => !v.isCurrent),
  };
};
