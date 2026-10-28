-- Requests can opt out of the client review step (for example when the client is MEGS itself).
ALTER TABLE "ManpowerRequest" ADD COLUMN "requiresClientReview" BOOLEAN NOT NULL DEFAULT true;
