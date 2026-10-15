CREATE TABLE "SecurityCounter" (
  "key" TEXT PRIMARY KEY,
  "hits" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "SecurityCounter_expiresAt_idx" ON "SecurityCounter"("expiresAt");
CREATE TABLE "SessionRevocation" (
  "tokenHash" TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "SessionRevocation_expiresAt_idx" ON "SessionRevocation"("expiresAt");
