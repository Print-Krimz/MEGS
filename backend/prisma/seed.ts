import "dotenv/config";
import prisma from "../src/utils/prisma.js";
import supabase from "../src/utils/supabase.js";
import { DEFAULT_WEIGHTS, DEFAULT_KNN_SETTINGS } from "../src/services/scoring/scoring-configuration.service.js";
import { SCORING_DIMENSIONS, ScoringDimension } from "../src/services/scoring/scoring.types.js";
import { Prisma } from "@prisma/client";

const REQUIRED_BUCKETS = [
  { id: "applicant-assets", public: false },
  { id: "documents", public: false },
];

async function ensureBuckets() {
  const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.warn("⚠️ Could not list storage buckets:", listError.message);
    return;
  }

  const existingBucketIds = new Set((existingBuckets || []).map((b) => b.id || b.name));
  for (const bucket of REQUIRED_BUCKETS) {
    if (!existingBucketIds.has(bucket.id)) {
      await supabase.storage.createBucket(bucket.id, {
        public: bucket.public,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
      });
      console.log(`✅ Created storage bucket: ${bucket.id}`);
    }
  }
}

async function main() {
  console.log("🌱 Starting authoritative database bootstrap seed (zero mock data)...");

  const adminEmail = process.env.ADMIN_EMAIL || "admin@megs-recruitment.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "AdminPassword123!";

  const taEmail = process.env.TA_EMAIL || "ta@megs-recruitment.com";
  const taPassword = process.env.TA_PASSWORD || "TAPassword123!";

  const { data: listData } = await supabase.auth.admin.listUsers();

  // 1. Seed/Sync Administrator
  let adminAuthId: string;
  const existingAdmin = listData?.users.find((u) => u.email?.toLowerCase() === adminEmail.toLowerCase());
  if (existingAdmin) {
    adminAuthId = existingAdmin.id;
    await supabase.auth.admin.updateUserById(adminAuthId, {
      password: adminPassword,
      email_confirm: true,
      user_metadata: { role: "ADMINISTRATOR", name: "System Administrator" },
    });
  } else {
    const { data: createData, error } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { role: "ADMINISTRATOR", name: "System Administrator" },
    });
    if (error || !createData.user) throw new Error(`Failed to create admin: ${error?.message}`);
    adminAuthId = createData.user.id;
  }

  await prisma.user.upsert({
    where: { id: adminAuthId },
    update: {
      email: adminEmail,
      role: "ADMINISTRATOR",
      isActive: true,
      accountStatus: "ACTIVE",
      mustChangePassword: false,
    },
    create: {
      id: adminAuthId,
      email: adminEmail,
      role: "ADMINISTRATOR",
      isActive: true,
      accountStatus: "ACTIVE",
      mustChangePassword: false,
    },
  });
  console.log(`✅ Bootstrapped Administrator account: ${adminEmail}`);

  // 2. Seed/Sync Talent Acquisition
  let taAuthId: string;
  const existingTa = listData?.users.find((u) => u.email?.toLowerCase() === taEmail.toLowerCase());
  if (existingTa) {
    taAuthId = existingTa.id;
    await supabase.auth.admin.updateUserById(taAuthId, {
      password: taPassword,
      email_confirm: true,
      user_metadata: { role: "TALENT_ACQUISITION", name: "Talent Acquisition" },
    });
  } else {
    const { data: createData, error } = await supabase.auth.admin.createUser({
      email: taEmail,
      password: taPassword,
      email_confirm: true,
      user_metadata: { role: "TALENT_ACQUISITION", name: "Talent Acquisition" },
    });
    if (error || !createData.user) throw new Error(`Failed to create TA: ${error?.message}`);
    taAuthId = createData.user.id;
  }

  await prisma.user.upsert({
    where: { id: taAuthId },
    update: {
      email: taEmail,
      role: "TALENT_ACQUISITION",
      isActive: true,
      accountStatus: "ACTIVE",
      mustChangePassword: false,
    },
    create: {
      id: taAuthId,
      email: taEmail,
      role: "TALENT_ACQUISITION",
      isActive: true,
      accountStatus: "ACTIVE",
      mustChangePassword: false,
    },
  });
  console.log(`✅ Bootstrapped Talent Acquisition account: ${taEmail}`);

  // 3. Ensure Active Candidate Scoring Configuration (v1)
  const existingConfig = await prisma.candidateScoringConfiguration.findFirst({
    where: { scope: "GLOBAL", status: "ACTIVE" },
  });

  if (!existingConfig) {
    await prisma.candidateScoringConfiguration.create({
      data: {
        scope: "GLOBAL",
        status: "ACTIVE",
        version: 1,
        revision: 1,
        knnSettings: DEFAULT_KNN_SETTINGS,
        createdById: adminAuthId,
        activatedById: adminAuthId,
        weights: {
          create: SCORING_DIMENSIONS.map((dimension: ScoringDimension) => ({
            dimension,
            weight: new Prisma.Decimal(DEFAULT_WEIGHTS[dimension]),
          })),
        },
      },
    });
    console.log("✅ Bootstrapped active default candidate scoring configuration (v1)");
  } else {
    console.log(`✅ Existing active candidate scoring configuration found (version ${existingConfig.version})`);
  }

  // 4. Ensure storage buckets
  await ensureBuckets();
  console.log("✅ Seed process completed successfully with zero mock records.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    prisma.$disconnect();
    process.exit(1);
  });
