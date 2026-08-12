-- ─────────────────────────────────────────────────────────────────────────────
-- P3: Constraints and Deployment Status History
-- Phase 3 — Database and Data-Flow Alignment
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. DeploymentStatusHistory ───────────────────────────────────────────────
-- Immutable audit trail of every deployment status transition.

CREATE TABLE "DeploymentStatusHistory" (
  "id"           SERIAL PRIMARY KEY,
  "deploymentId" INTEGER NOT NULL REFERENCES "Deployment"("id") ON DELETE RESTRICT,
  "fromStatus"   "DeploymentStatus",
  "toStatus"     "DeploymentStatus" NOT NULL,
  "changedById"  TEXT NOT NULL REFERENCES "User"("id"),
  "reason"       TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "DeploymentStatusHistory_deploymentId_createdAt_idx"
  ON "DeploymentStatusHistory"("deploymentId", "createdAt");

-- ── 2. Uniqueness Constraint: One application per user per job ───────────────
-- Prevents race-condition duplicate applications.

ALTER TABLE "Application"
  ADD CONSTRAINT "Application_userId_jobPostingId_unique"
  UNIQUE ("userId", "jobPostingId");

-- ── 3. Partial Unique Index: One active deployment per application ────────────
-- A new deployment can be created only after the existing one is ENDED or CANCELLED.

CREATE UNIQUE INDEX "Deployment_applicationId_active_unique"
  ON "Deployment"("applicationId")
  WHERE "status" NOT IN ('ENDED', 'CANCELLED');

-- ── 4. Check Constraint: Valid aiScore range ──────────────────────────────────
-- Gemini scores are clamped 0–100 in service code; this enforces it at DB level.

ALTER TABLE "Application"
  ADD CONSTRAINT "Application_aiScore_range"
  CHECK ("aiScore" IS NULL OR ("aiScore" >= 0 AND "aiScore" <= 100));

-- ── 5. Check Constraint: Valid ManpowerRequest headcount ─────────────────────

ALTER TABLE "ManpowerRequest"
  ADD CONSTRAINT "ManpowerRequest_headcount_positive"
  CHECK ("headcount" >= 1);

-- ── 6. Check Constraint: Valid Deployment contract date range ─────────────────

ALTER TABLE "Deployment"
  ADD CONSTRAINT "Deployment_contractDates_valid"
  CHECK ("contractEnd" IS NULL OR "contractEnd" >= "contractStart");
