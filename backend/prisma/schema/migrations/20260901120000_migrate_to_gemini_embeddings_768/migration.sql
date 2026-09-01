-- Alter CandidateFeatureProfile embedding column to vector(768) and clear legacy 384-d vectors
ALTER TABLE "CandidateFeatureProfile" 
  ALTER COLUMN "embedding" TYPE vector(768) USING NULL;

