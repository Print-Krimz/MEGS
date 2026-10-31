-- 1. A deployment confirmed as Active on site with a start date still in the future goes back to Ready to
--    start. The date stays in "actualStart"; the scheduled job activates it when the day comes.
UPDATE "Deployment"
SET "status" = 'READY_FOR_DEPLOYMENT'
WHERE "status" = 'ACTIVE' AND "actualStart" > NOW();

-- 2. Employees who are still active but have not started: a pending deployment, or no deployment yet.
UPDATE "Employee" e
SET "status" = 'AWAITING_START'
WHERE e."status" = 'ACTIVE'
  AND NOT EXISTS (SELECT 1 FROM "Deployment" d WHERE d."employeeId" = e."id" AND d."status" = 'ACTIVE')
  AND (
    EXISTS (SELECT 1 FROM "Deployment" d WHERE d."employeeId" = e."id" AND d."status" IN ('READY_FOR_DEPLOYMENT', 'READY', 'PENDING_ORIENTATION'))
    OR NOT EXISTS (SELECT 1 FROM "Deployment" d WHERE d."employeeId" = e."id")
  );
