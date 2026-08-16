import "dotenv/config";
import prisma from "../src/utils/prisma.js";
import supabase from "../src/utils/supabase.js";
import { DEFAULT_WEIGHTS, DEFAULT_KNN_SETTINGS } from "../src/services/scoring/scoring-configuration.service.js";
import { SCORING_DIMENSIONS, ScoringDimension } from "../src/services/scoring/scoring.types.js";
import { Prisma } from "@prisma/client";

interface RequiredUser {
  email: string;
  password: string;
  role: "ADMINISTRATOR" | "TALENT_ACQUISITION";
  name: string;
}

const REQUIRED_USERS: RequiredUser[] = [
  {
    email: process.env.ADMIN_EMAIL || "admin@megs-recruitment.com",
    password: process.env.ADMIN_PASSWORD || "AdminPassword123!",
    role: "ADMINISTRATOR",
    name: "System Administrator",
  },
  {
    email: process.env.TA_EMAIL || "ta@megs-recruitment.com",
    password: process.env.TA_PASSWORD || "TAPassword123!",
    role: "TALENT_ACQUISITION",
    name: "Talent Acquisition",
  },
];

const REQUIRED_BUCKETS = [
  { id: "applicant-assets", public: false },
  { id: "documents", public: false },
];

async function syncRequiredAuthUser(userConfig: RequiredUser): Promise<string> {
  const { email, password, role, name } = userConfig;
  console.log(`🔐 Syncing required access account: ${email} (${role})...`);

  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    throw new Error(`Failed to list Supabase users: ${listError.message}`);
  }

  const existing = listData?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  let userId: string;

  if (existing) {
    userId = existing.id;
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { role, name },
    });
    if (updateError) {
      throw new Error(`Failed to update password for ${email}: ${updateError.message}`);
    }
    console.log(`  ✅ Supabase Auth synced for ${email} (${userId})`);
  } else {
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, name },
    });
    if (createError || !createData.user) {
      throw new Error(`Failed to create Supabase Auth user for ${email}: ${createError?.message}`);
    }
    userId = createData.user.id;
    console.log(`  ✅ Supabase Auth user created for ${email} (${userId})`);
  }

  return userId;
}

async function cleanSupabaseAuth(keptUserIds: Set<string>) {
  console.log("\n🧹 Cleaning up other Supabase Auth users...");
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("  Failed to list Supabase users for cleanup:", listError.message);
    return;
  }

  let deletedCount = 0;
  for (const user of listData.users) {
    if (!keptUserIds.has(user.id)) {
      console.log(`  🗑️ Deleting Supabase auth user: ${user.email || user.id}`);
      const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
      if (delErr) {
        console.warn(`    Could not delete auth user ${user.id}: ${delErr.message}`);
      } else {
        deletedCount++;
      }
    }
  }
  console.log(`  ✅ Deleted ${deletedCount} extra Supabase Auth user(s).`);
}

async function ensureStorageBuckets() {
  console.log("\n🗄️ Checking Supabase Storage buckets...");
  const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.warn("  Could not list storage buckets:", listError.message);
    return;
  }

  const existingBucketIds = new Set((existingBuckets || []).map((b) => b.id || b.name));

  for (const bucket of REQUIRED_BUCKETS) {
    if (!existingBucketIds.has(bucket.id)) {
      console.log(`  Creating storage bucket '${bucket.id}'...`);
      const { error } = await supabase.storage.createBucket(bucket.id, {
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

      if (error) {
        console.warn(`  Could not create bucket '${bucket.id}':`, error.message);
      } else {
        console.log(`  ✅ Successfully created bucket '${bucket.id}'`);
      }
    } else {
      console.log(`  ✅ Bucket '${bucket.id}' is present.`);
    }
  }
}

async function cleanDatabaseTables(adminId: string, taId: string) {
  console.log("\n🧹 Purging all mock data from Postgres database in topological FK order...");

  // 1. Post-hire, deployment & history
  await prisma.employmentEvent.deleteMany({});
  console.log("  - Deleted EmploymentEvents");

  await prisma.deploymentStatusHistory.deleteMany({});
  console.log("  - Deleted DeploymentStatusHistory");

  await prisma.deployment.deleteMany({});
  console.log("  - Deleted Deployments");

  await prisma.employee.deleteMany({});
  console.log("  - Deleted Employees");

  // 2. Compliance & endorsements
  await prisma.mRFComplianceTemplate.deleteMany({});
  console.log("  - Deleted MRFComplianceTemplates");

  await prisma.complianceRequirement.deleteMany({});
  console.log("  - Deleted ComplianceRequirements");

  await prisma.clientEndorsement.deleteMany({});
  console.log("  - Deleted ClientEndorsements");

  // 3. Application pipelines, decisions, interviews, documents
  await prisma.recruiterDecision.deleteMany({});
  console.log("  - Deleted RecruiterDecisions");

  await prisma.interview.deleteMany({});
  console.log("  - Deleted Interviews");

  await prisma.postHireDocument.deleteMany({});
  console.log("  - Deleted PostHireDocuments");

  await prisma.candidateScore.deleteMany({});
  console.log("  - Deleted CandidateScores");

  await prisma.scoringRevalidationTask.deleteMany({});
  console.log("  - Deleted ScoringRevalidationTasks");

  await prisma.talentPoolContact.deleteMany({});
  console.log("  - Deleted TalentPoolContacts");

  await prisma.talentPoolMembership.deleteMany({});
  console.log("  - Deleted TalentPoolMemberships");

  await prisma.candidateFeatureProfile.deleteMany({});
  console.log("  - Deleted CandidateFeatureProfiles");

  await prisma.storedDocument.deleteMany({});
  console.log("  - Deleted StoredDocuments");

  await prisma.application.deleteMany({});
  console.log("  - Deleted Applications");

  // 4. Job postings, MRFs, Clients
  await prisma.jobPosting.deleteMany({});
  console.log("  - Deleted JobPostings");

  await prisma.manpowerRequest.deleteMany({});
  console.log("  - Deleted ManpowerRequests");

  await prisma.client.deleteMany({});
  console.log("  - Deleted Clients");

  // 5. Applicant profiles, sub-tables & skills
  await prisma.workExperience.deleteMany({});
  console.log("  - Deleted WorkExperiences");

  await prisma.education.deleteMany({});
  console.log("  - Deleted Educations");

  await prisma.applicantSkill.deleteMany({});
  console.log("  - Deleted ApplicantSkills");

  await prisma.skill.deleteMany({});
  console.log("  - Deleted Skills");

  await prisma.trainingCertification.deleteMany({});
  console.log("  - Deleted TrainingCertifications");

  await prisma.characterReference.deleteMany({});
  console.log("  - Deleted CharacterReferences");

  await prisma.asset.deleteMany({});
  console.log("  - Deleted Assets");

  await prisma.applicantProfile.deleteMany({});
  console.log("  - Deleted ApplicantProfiles");

  // 6. Notifications, Outboxes, Audit Logs
  await prisma.notificationOutbox.deleteMany({});
  console.log("  - Deleted NotificationOutboxes");

  await prisma.notification.deleteMany({});
  console.log("  - Deleted Notifications");

  await prisma.auditLog.deleteMany({});
  console.log("  - Deleted AuditLogs");

  // 7. Scoring Configurations & Weights
  await prisma.candidateScoringWeight.deleteMany({});
  console.log("  - Deleted CandidateScoringWeights");

  await prisma.candidateScoringConfiguration.deleteMany({});
  console.log("  - Deleted CandidateScoringConfigurations");

  // 8. Delete all users except Admin and TA
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      id: { notIn: [adminId, taId] },
    },
  });
  console.log(`  - Deleted ${deletedUsers.count} mock User record(s)`);

  // 9. Ensure Admin and TA accounts are active in Postgres
  await prisma.user.upsert({
    where: { id: adminId },
    update: {
      email: REQUIRED_USERS[0].email,
      role: "ADMINISTRATOR",
      isActive: true,
      accountStatus: "ACTIVE",
      mustChangePassword: false,
    },
    create: {
      id: adminId,
      email: REQUIRED_USERS[0].email,
      role: "ADMINISTRATOR",
      isActive: true,
      accountStatus: "ACTIVE",
      mustChangePassword: false,
    },
  });

  await prisma.user.upsert({
    where: { id: taId },
    update: {
      email: REQUIRED_USERS[1].email,
      role: "TALENT_ACQUISITION",
      isActive: true,
      accountStatus: "ACTIVE",
      mustChangePassword: false,
    },
    create: {
      id: taId,
      email: REQUIRED_USERS[1].email,
      role: "TALENT_ACQUISITION",
      isActive: true,
      accountStatus: "ACTIVE",
      mustChangePassword: false,
    },
  });

  // 10. Re-seed default scoring configuration (v1)
  await prisma.candidateScoringConfiguration.create({
    data: {
      scope: "GLOBAL",
      status: "ACTIVE",
      version: 1,
      revision: 1,
      knnSettings: DEFAULT_KNN_SETTINGS,
      createdById: adminId,
      activatedById: adminId,
      weights: {
        create: SCORING_DIMENSIONS.map((dimension: ScoringDimension) => ({
          dimension,
          weight: new Prisma.Decimal(DEFAULT_WEIGHTS[dimension]),
        })),
      },
    },
  });
  console.log("  - Seeded fresh default candidate scoring configuration (v1)");
}

async function main() {
  console.log("==================================================");
  console.log("🧹 MEGS DATABASE AUDIT & PRODUCTION RESET CLEANUP");
  console.log("==================================================");

  try {
    const adminId = await syncRequiredAuthUser(REQUIRED_USERS[0]);
    const taId = await syncRequiredAuthUser(REQUIRED_USERS[1]);

    const keptIds = new Set([adminId, taId]);
    await cleanSupabaseAuth(keptIds);
    await cleanDatabaseTables(adminId, taId);
    await ensureStorageBuckets();

    console.log("\n==================================================");
    console.log("✨ DATABASE CLEANUP SUCCESSFUL: FRESH PRODUCTION BASELINE");
    console.log("==================================================");
    console.log("\nActive Required Accounts:");
    console.log(`1. Administrator:      ${REQUIRED_USERS[0].email}`);
    console.log(`   Password:          ${REQUIRED_USERS[0].password}`);
    console.log(`   User ID:           ${adminId}`);
    console.log(`\n2. Talent Acquisition: ${REQUIRED_USERS[1].email}`);
    console.log(`   Password:          ${REQUIRED_USERS[1].password}`);
    console.log(`   User ID:           ${taId}`);
    console.log("==================================================\n");
  } catch (error) {
    console.error("❌ Database cleanup failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
