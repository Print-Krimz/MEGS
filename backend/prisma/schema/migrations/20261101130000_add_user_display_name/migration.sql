ALTER TABLE "User" ADD COLUMN "displayName" TEXT;

UPDATE "User" AS u
SET "displayName" = NULLIF(CONCAT_WS(' ', NULLIF(BTRIM(p."firstName"), ''), NULLIF(BTRIM(p."lastName"), '')), '')
FROM "ApplicantProfile" AS p
WHERE p."userId" = u."id"
  AND u."role" IN ('ADMINISTRATOR', 'TALENT_ACQUISITION');
