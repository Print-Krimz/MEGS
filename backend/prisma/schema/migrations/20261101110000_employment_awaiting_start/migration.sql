-- A hired worker who has not reached the client site yet is Awaiting start, not an Active employee.
-- Adding an enum value must commit before it can be used, so the data backfill is the next migration.
ALTER TYPE "EmploymentStatus" ADD VALUE IF NOT EXISTS 'AWAITING_START' BEFORE 'ACTIVE';
