-- Remove assignment check-ins: the "Record check-in" feature was dropped.
-- Both the table and the column were empty when this was written (2026-10-26).

DROP TABLE IF EXISTS "DeploymentReview";

ALTER TABLE "Deployment" DROP COLUMN IF EXISTS "nextReviewAt";
