// prisma/seed.ts
// Quick seed script — inserts two mock job postings for testing.
// Run with: npx tsx prisma/seed.ts

import prisma from "../src/utils/prisma.js";

async function main() {
  // We need a User to be the "poster" — reuse our test applicant's UUID
  // In production, this would be a TA staff account, but for dev testing any user works
  const poster = await prisma.user.findFirst();

  if (!poster) {
    throw new Error("No users found in DB. Please register first via POST /api/auth/register");
  }

  const job1 = await prisma.jobPosting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      postedById: poster.id,
      title: "Senior React Developer",
      description: "We are looking for a Senior React Developer to join our growing team. You will be responsible for building and maintaining front-end applications.",
      requirements: "5+ years of experience with React, TypeScript, REST APIs, and modern frontend tooling. Experience with state management libraries (Zustand, Redux).",
      location: "Makati City (Hybrid)",
      status: "OPEN",
    },
  });

  const job2 = await prisma.jobPosting.upsert({
    where: { id: 2 },
    update: {},
    create: {
      postedById: poster.id,
      title: "Node.js Backend Engineer",
      description: "Join our backend team to build scalable APIs and services that power our platform.",
      requirements: "3+ years of Node.js experience, proficiency with Express or Fastify, PostgreSQL, Prisma ORM, and RESTful API design.",
      location: "Remote (Philippines)",
      status: "OPEN",
    },
  });

  console.log("✅ Seeded job postings:");
  console.log(` - [ID: ${job1.id}] ${job1.title}`);
  console.log(` - [ID: ${job2.id}] ${job2.title}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    prisma.$disconnect();
    process.exit(1);
  });
