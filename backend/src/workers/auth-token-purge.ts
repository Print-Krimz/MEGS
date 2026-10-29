import prisma from "../utils/prisma.js";

const RETENTION_DAYS = 7;
const BATCH_SIZE = 1000;

/**
 * Deletes one-time codes and password reset sessions that expired more than 7 days ago.
 * No auth flow reads rows this old: the resend cooldowns look at the latest row's createdAt
 * (60 seconds) and verification rejects anything past expiresAt. Deletes in batches of ids
 * so no single statement locks a large range.
 */
export const purgeExpiredAuthTokens = async (now: Date = new Date()): Promise<{ otp: number; resetSessions: number }> => {
  const where = { expiresAt: { lt: new Date(now.getTime() - RETENTION_DAYS * 86_400_000) } };

  let otp = 0;
  for (;;) {
    const rows = await prisma.authOtp.findMany({ where, select: { id: true }, take: BATCH_SIZE });
    if (rows.length === 0) break;
    otp += (await prisma.authOtp.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } })).count;
    if (rows.length < BATCH_SIZE) break;
  }

  let resetSessions = 0;
  for (;;) {
    const rows = await prisma.passwordResetSession.findMany({ where, select: { id: true }, take: BATCH_SIZE });
    if (rows.length === 0) break;
    resetSessions += (await prisma.passwordResetSession.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } })).count;
    if (rows.length < BATCH_SIZE) break;
  }

  return { otp, resetSessions };
};
