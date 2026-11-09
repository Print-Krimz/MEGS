-- Paper manpower requisition form fields. All optional, so existing requests are unchanged.
ALTER TABLE "ManpowerRequest" ADD COLUMN IF NOT EXISTS "department" TEXT;
ALTER TABLE "ManpowerRequest" ADD COLUMN IF NOT EXISTS "workShift" TEXT;
ALTER TABLE "ManpowerRequest" ADD COLUMN IF NOT EXISTS "workDays" TEXT;
ALTER TABLE "ManpowerRequest" ADD COLUMN IF NOT EXISTS "workHoursPerDay" INTEGER;
ALTER TABLE "ManpowerRequest" ADD COLUMN IF NOT EXISTS "workTime" TEXT;
ALTER TABLE "ManpowerRequest" ADD COLUMN IF NOT EXISTS "requestReason" TEXT;
ALTER TABLE "ManpowerRequest" ADD COLUMN IF NOT EXISTS "requestReasonNote" TEXT;
