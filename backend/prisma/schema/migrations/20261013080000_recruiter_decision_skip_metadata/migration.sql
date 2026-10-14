-- Additive: records whether a stage change was a normal move, an authorised skip, or a fast track.
ALTER TABLE "RecruiterDecision" ADD COLUMN IF NOT EXISTS "transitionType" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "RecruiterDecision" ADD COLUMN IF NOT EXISTS "skippedStages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
