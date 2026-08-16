import "dotenv/config";
import prisma from "../src/utils/prisma.js";
import supabase from "../src/utils/supabase.js";

interface AccountSetupConfig {
  email: string;
  password: string;
  role: "ADMINISTRATOR" | "TALENT_ACQUISITION";
  name: string;
}

const accountsToCreate: AccountSetupConfig[] = [
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
    name: "Talent Acquisition Lead",
  },
];

async function setupAccount(config: AccountSetupConfig) {
  const { email, password, role, name } = config;
  console.log(`\n⚙️ Setting up ${role} account (${email})...`);

  let supabaseUserId: string;

  // 1. Check if user exists in Supabase Auth
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    throw new Error(`Failed to list Supabase users: ${listError.message}`);
  }

  const existingAuthUser = listData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (existingAuthUser) {
    supabaseUserId = existingAuthUser.id;
    console.log(`  Found existing Supabase Auth user: ${supabaseUserId}`);
    // Update password & confirm email
    const { error: updateError } = await supabase.auth.admin.updateUserById(supabaseUserId, {
      password: password,
      email_confirm: true,
      user_metadata: { role, name },
    });
    if (updateError) {
      throw new Error(`Failed to update password for ${email}: ${updateError.message}`);
    }
    console.log(`  Updated Supabase Auth password & metadata.`);
  } else {
    // Create new Supabase Auth user
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, name },
    });
    if (createError || !createData.user) {
      throw new Error(`Failed to create Supabase Auth user for ${email}: ${createError?.message}`);
    }
    supabaseUserId = createData.user.id;
    console.log(`  Created new Supabase Auth user: ${supabaseUserId}`);
  }

  // 2. Upsert in PostgreSQL DB via Prisma
  const dbUser = await prisma.user.upsert({
    where: { id: supabaseUserId },
    update: {
      email,
      role,
      isActive: true,
      accountStatus: "ACTIVE",
      mustChangePassword: false,
    },
    create: {
      id: supabaseUserId,
      email,
      role,
      isActive: true,
      accountStatus: "ACTIVE",
      mustChangePassword: false,
    },
  });

  // 3. If there is an old user record with this email but different ID, clean up or warn
  const duplicateEmailUsers = await prisma.user.findMany({
    where: {
      email,
      id: { not: supabaseUserId },
    },
  });

  for (const dup of duplicateEmailUsers) {
    console.log(`  ⚠️ Cleaning up orphaned user record with matching email: ${dup.id}`);
    await prisma.user.delete({ where: { id: dup.id } }).catch(() => {
      console.warn(`    Could not delete duplicate user ${dup.id} due to constraints`);
    });
  }

  console.log(`  ✅ Database record synced: [${dbUser.id}] Role: ${dbUser.role}, Status: ${dbUser.accountStatus}`);
  return { email, password, role, id: dbUser.id };
}

async function main() {
  console.log("==================================================");
  console.log("🔐 MEGS ACCOUNT CREDENTIALS GENERATOR / SYNC");
  console.log("==================================================");

  try {
    const results = [];
    for (const acc of accountsToCreate) {
      const res = await setupAccount(acc);
      results.push(res);
    }

    console.log("\n==================================================");
    console.log("🎉 ACCOUNT CREDENTIALS READY FOR FRONTEND ACCESS");
    console.log("==================================================");
    for (const r of results) {
      console.log(`\nRole:     ${r.role}`);
      console.log(`Email:    ${r.email}`);
      console.log(`Password: ${r.password}`);
      console.log(`User ID:  ${r.id}`);
    }
    console.log("\n==================================================");
  } catch (err: any) {
    console.error("\n❌ Error creating accounts:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
