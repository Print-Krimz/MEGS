// prisma.config.ts
//
// WHY THIS FILE EXISTS:
// In Prisma 7, the database connection URL is no longer set inside schema.prisma.
// Instead, it lives here — in a dedicated config file.
// This separates "what your database looks like" (schema.prisma)
// from "how to connect to it" (this file).

import { defineConfig } from "prisma/config";

// Load .env variables before Prisma reads them
import "dotenv/config";

export default defineConfig({
  // Point to the folder where our split schema files are located
  schema: "./prisma/schema",

  // Provide the database URL for migrations (must be direct connection)
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
