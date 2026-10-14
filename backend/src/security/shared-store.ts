import type { Options, Store } from "express-rate-limit";
import prisma from "../utils/prisma.js";

export const connectSharedStore = async (): Promise<void> => {
  await prisma.$queryRaw`SELECT "key" FROM "SecurityCounter" LIMIT 0`;
  await prisma.$queryRaw`SELECT "tokenHash" FROM "SessionRevocation" LIMIT 0`;
};

export class PostgresRateLimitStore implements Store {
  localKeys = false;
  readonly prefix: string;
  private windowMs = 60_000;
  constructor(name: string) { this.prefix = `rate:${name}:`; }
  init(options: Options): void { this.windowMs = options.windowMs; }
  async increment(key: string) {
    // ON CONFLICT holds a row lock: concurrent replicas cannot lose increments.
    // The database clock controls window expiry and renewal.
    const rows = await prisma.$queryRaw<{ hits: number; expiresAt: Date }[]>`
      INSERT INTO "SecurityCounter" ("key", "hits", "expiresAt")
      VALUES (${this.prefix + key}, 1, statement_timestamp() + ${this.windowMs} * interval '1 millisecond')
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE WHEN "SecurityCounter"."expiresAt" <= statement_timestamp() THEN 1 ELSE "SecurityCounter"."hits" + 1 END,
        "expiresAt" = CASE WHEN "SecurityCounter"."expiresAt" <= statement_timestamp()
          THEN statement_timestamp() + ${this.windowMs} * interval '1 millisecond' ELSE "SecurityCounter"."expiresAt" END
      RETURNING "hits", "expiresAt"`;
    return { totalHits: rows[0]!.hits, resetTime: rows[0]!.expiresAt };
  }
  async decrement(key: string): Promise<void> {
    await prisma.$executeRaw`UPDATE "SecurityCounter" SET "hits" = GREATEST(0, "hits" - 1) WHERE "key" = ${this.prefix + key}`;
  }
  async resetKey(key: string): Promise<void> {
    await prisma.$executeRaw`DELETE FROM "SecurityCounter" WHERE "key" = ${this.prefix + key}`;
  }
}

// Bounded indexed cleanup. Expired rows never affect enforcement if cleanup fails.
export const cleanupSecurityState = async (): Promise<void> => {
  await prisma.$executeRaw`DELETE FROM "SecurityCounter" WHERE "key" IN
    (SELECT "key" FROM "SecurityCounter" WHERE "expiresAt" <= statement_timestamp() LIMIT 1000)`;
  await prisma.$executeRaw`DELETE FROM "SessionRevocation" WHERE "tokenHash" IN
    (SELECT "tokenHash" FROM "SessionRevocation" WHERE "expiresAt" <= statement_timestamp() LIMIT 1000)`;
};
