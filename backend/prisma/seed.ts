import prisma from "../src/utils/prisma.js";
import supabase from "../src/utils/supabase.js";

async function main() {
  console.log("🌱 Starting database seed...");

  const adminEmail = process.env.ADMIN_EMAIL || "admin@megs-recruitment.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "AdminSecure2026!";

  // 1. Ensure initial Administrator exists
  let adminUser = await prisma.user.findFirst({
    where: { role: "ADMINISTRATOR" },
  });

  if (!adminUser) {
    console.log(`👤 Seeding initial Administrator: ${adminEmail}`);

    let supabaseUserId: string;
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });

    if (createError) {
      if (createError.message.includes("already registered") || createError.message.includes("already exists")) {
        // Find user by listing users
        const { data: listData } = await supabase.auth.admin.listUsers();
        const existingAuth = listData.users.find((u) => u.email === adminEmail);
        if (!existingAuth) throw new Error("Admin exists in auth but could not be located");
        supabaseUserId = existingAuth.id;
        await supabase.auth.admin.updateUserById(supabaseUserId, { password: adminPassword });
      } else {
        throw new Error(`Failed to create initial admin in Supabase: ${createError.message}`);
      }
    } else {
      supabaseUserId = createData.user.id;
    }

    adminUser = await prisma.user.upsert({
      where: { id: supabaseUserId },
      update: {
        role: "ADMINISTRATOR",
        isActive: true,
        accountStatus: "ACTIVE",
      },
      create: {
        id: supabaseUserId,
        email: adminEmail,
        role: "ADMINISTRATOR",
        accountStatus: "ACTIVE",
        mustChangePassword: false,
      },
    });

    console.log(`✅ Seeded Administrator account [${adminUser.id}] (${adminUser.email})`);
  } else {
    console.log(`ℹ️  Administrator account already exists: ${adminUser.email}`);
  }

  // 2. Seed Mock Job Postings
  const job1 = await prisma.jobPosting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      postedById: adminUser.id,
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
      postedById: adminUser.id,
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
