import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "./env.js";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});

// Prevent unhandled errors from terminating the Node process when pooler/PgBouncer closes idle sockets
pool.on("error", (err) => {
  console.warn("⚠️ [pg.Pool] Unexpected error on idle database client:", err?.message || err);
});

const adapter = new PrismaPg(pool);

// Shared Prisma client with PostgreSQL adapter.
const prisma = new PrismaClient({ adapter });

export default prisma;
