import { createHash } from "node:crypto";
import prisma from "../utils/prisma.js";
const tokenHash = (token: string): string => createHash("sha256").update(token).digest("hex");

export const revokeSession = async (token: string, expiresAt: number): Promise<void> => {
  if (!Number.isFinite(expiresAt)) throw new Error("Invalid session expiry");
  const expiry = new Date((expiresAt + 30) * 1000);
  await prisma.$executeRaw`INSERT INTO "SessionRevocation" ("tokenHash", "expiresAt")
    VALUES (${tokenHash(token)}, ${expiry}) ON CONFLICT ("tokenHash") DO UPDATE
    SET "expiresAt" = GREATEST("SessionRevocation"."expiresAt", EXCLUDED."expiresAt")`;
};

export const isSessionRevoked = async (token: string): Promise<boolean> => {
  const rows = await prisma.$queryRaw<{ revoked: boolean }[]>`SELECT EXISTS (
    SELECT 1 FROM "SessionRevocation" WHERE "tokenHash" = ${tokenHash(token)}
      AND "expiresAt" > clock_timestamp()) AS "revoked"`;
  return rows[0]!.revoked;
};
