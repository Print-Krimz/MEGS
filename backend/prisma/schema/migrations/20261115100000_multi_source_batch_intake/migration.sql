-- Multi-source applicant intake: more recruitment sources plus a free-text detail. Additive only.
ALTER TYPE "ApplicationSource" ADD VALUE IF NOT EXISTS 'LINKEDIN';
ALTER TYPE "ApplicationSource" ADD VALUE IF NOT EXISTS 'JOBSTREET';
ALTER TYPE "ApplicationSource" ADD VALUE IF NOT EXISTS 'BOSSJOB';
ALTER TYPE "ApplicationSource" ADD VALUE IF NOT EXISTS 'FACEBOOK';
ALTER TYPE "ApplicationSource" ADD VALUE IF NOT EXISTS 'EMAIL';
ALTER TYPE "ApplicationSource" ADD VALUE IF NOT EXISTS 'REFERRAL';
ALTER TYPE "ApplicationSource" ADD VALUE IF NOT EXISTS 'OTHER';

ALTER TABLE "Application" ADD COLUMN "sourceDetail" VARCHAR(100);
