-- Do not discard or guess ownership of conflicting legacy placements.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Deployment"
    WHERE "status" NOT IN ('ENDED', 'CANCELLED')
    GROUP BY "employeeId" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Resolve employees with multiple live deployments before applying the exclusive placement migration';
  END IF;
END $$;

CREATE UNIQUE INDEX "Deployment_one_live_placement_per_employee"
ON "Deployment" ("employeeId")
WHERE "status" NOT IN ('ENDED', 'CANCELLED');
