-- The signed paper is the record of position and pay. The system only keeps the start date and the signed scan.
ALTER TABLE "Application"
  DROP COLUMN "contractPosition",
  DROP COLUMN "contractDailyRate";
