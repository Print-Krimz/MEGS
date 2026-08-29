import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});

const adapter = new PrismaPg(pool);

// Shared Prisma client with PostgreSQL adapter.
const prisma = new PrismaClient({ adapter });

export default prisma;
