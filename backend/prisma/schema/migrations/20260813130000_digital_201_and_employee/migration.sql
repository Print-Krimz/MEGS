-- ─────────────────────────────────────────────────────────────────────────────
-- DIGITAL 201 & EMPLOYEE DOMAIN
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create Enums
DO $$ BEGIN
  CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SEPARATED', 'AVAILABLE_FOR_REDEPLOYMENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmploymentEventType" AS ENUM ('HIRED', 'DEPLOYED', 'ASSIGNMENT_ENDED', 'REDEPLOYED', 'STATUS_CHANGE', 'SEPARATED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create Employee Table
CREATE TABLE IF NOT EXISTS "Employee" (
    "id" SERIAL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE RESTRICT,
    "employeeNumber" TEXT NOT NULL UNIQUE,
    "status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "hireDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "department" TEXT,
    "position" TEXT,
    "originatingApplicationId" INTEGER UNIQUE REFERENCES "Application"("id") ON DELETE SET NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Employee_status_idx" ON "Employee"("status");
CREATE INDEX IF NOT EXISTS "Employee_employeeNumber_idx" ON "Employee"("employeeNumber");

-- 3. Create EmploymentEvent Table
CREATE TABLE IF NOT EXISTS "EmploymentEvent" (
    "id" SERIAL PRIMARY KEY,
    "employeeId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT,
    "eventType" "EmploymentEventType" NOT NULL,
    "description" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "actorId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "EmploymentEvent_employeeId_effectiveDate_idx" ON "EmploymentEvent"("employeeId", "effectiveDate" DESC);

-- 4. Data Migration: Backfill from Vault201 if table exists
DO $$ 
DECLARE
  r RECORD;
  v_user_id TEXT;
  v_emp_num TEXT;
  v_emp_id INTEGER;
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Vault201') THEN
    FOR r IN SELECT * FROM "Vault201" LOOP
      SELECT "userId" INTO v_user_id FROM "Application" WHERE "id" = r."applicationId";
      IF v_user_id IS NOT NULL THEN
        v_emp_num := COALESCE(r."employeeId", 'EMP-' || TO_CHAR(COALESCE(r."startDate", r."createdAt", CURRENT_TIMESTAMP), 'YYYY') || '-' || LPAD(r."id"::TEXT, 5, '0'));
        
        INSERT INTO "Employee" ("userId", "employeeNumber", "status", "hireDate", "department", "position", "originatingApplicationId", "notes", "createdAt", "updatedAt")
        VALUES (v_user_id, v_emp_num, 'ACTIVE', COALESCE(r."startDate", r."createdAt", CURRENT_TIMESTAMP), r."department", r."position", r."applicationId", r."notes", r."createdAt", r."updatedAt")
        ON CONFLICT ("userId") DO UPDATE SET
          "originatingApplicationId" = EXCLUDED."originatingApplicationId"
        RETURNING "id" INTO v_emp_id;

        INSERT INTO "EmploymentEvent" ("employeeId", "eventType", "description", "effectiveDate", "createdAt")
        VALUES (v_emp_id, 'HIRED', 'Employee hired from application #' || r."applicationId", COALESCE(r."startDate", r."createdAt", CURRENT_TIMESTAMP), r."createdAt");
      END IF;
    END LOOP;
  END IF;
END $$;

-- 5. Update Deployment table to reference Employee
DO $$ BEGIN
  ALTER TABLE "Deployment" ADD COLUMN "employeeId" INTEGER;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Backfill Deployment.employeeId from Application -> User -> Employee
DO $$
DECLARE
  d RECORD;
  v_emp_id INTEGER;
  v_user_id TEXT;
BEGIN
  FOR d IN SELECT * FROM "Deployment" WHERE "employeeId" IS NULL LOOP
    SELECT "userId" INTO v_user_id FROM "Application" WHERE "id" = d."applicationId";
    IF v_user_id IS NOT NULL THEN
      SELECT "id" INTO v_emp_id FROM "Employee" WHERE "userId" = v_user_id;
      IF v_emp_id IS NULL THEN
        -- Create employee record for existing deployed application
        INSERT INTO "Employee" ("userId", "employeeNumber", "status", "hireDate", "originatingApplicationId", "createdAt", "updatedAt")
        VALUES (v_user_id, 'EMP-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYY') || '-' || LPAD(d."id"::TEXT, 5, '0'), 'ACTIVE', CURRENT_TIMESTAMP, d."applicationId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING "id" INTO v_emp_id;
      END IF;

      UPDATE "Deployment" SET "employeeId" = v_emp_id WHERE "id" = d."id";
    END IF;
  END LOOP;
END $$;

-- Ensure employeeId is NOT NULL (default fallback to 1 if any orphan)
DO $$
DECLARE
  v_first_emp INTEGER;
BEGIN
  SELECT "id" INTO v_first_emp FROM "Employee" LIMIT 1;
  IF v_first_emp IS NOT NULL THEN
    UPDATE "Deployment" SET "employeeId" = v_first_emp WHERE "employeeId" IS NULL;
  END IF;
END $$;

-- Alter column to NOT NULL and add foreign key
DO $$ BEGIN
  ALTER TABLE "Deployment" ALTER COLUMN "employeeId" SET NOT NULL;
EXCEPTION
  WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "Deployment_employeeId_idx" ON "Deployment"("employeeId");

-- 6. Drop legacy Vault201 table
DROP TABLE IF EXISTS "Vault201";
