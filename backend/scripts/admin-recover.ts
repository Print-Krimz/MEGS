import "dotenv/config";
import prisma from "../src/utils/prisma.js";
import supabase from "../src/utils/supabase.js";
import { logAudit } from "../src/utils/audit.js";
import crypto from "crypto";

async function runAdminRecovery() {
  console.log("==================================================");
  console.log("🚨 MEGS EMERGENCY ADMINISTRATOR RECOVERY TOOL");
  console.log("==================================================");

  try {
    // Check CLI argument for --new-email or environment variables
    const args = process.argv.slice(2);
    let requestedEmail: string | undefined = undefined;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith("--new-email=")) {
        requestedEmail = arg.slice("--new-email=".length).trim();
      } else if (arg === "--new-email" && args[i + 1]) {
        requestedEmail = args[i + 1].trim();
      }
    }

    if (!requestedEmail && process.env.ADMIN_NEW_EMAIL) {
      requestedEmail = process.env.ADMIN_NEW_EMAIL.trim();
    }

    const defaultEmail = process.env.ADMIN_EMAIL || "admin@megs-recruitment.com";

    // 1. Locate existing Administrator
    let admin = await prisma.user.findFirst({
      where: { role: "ADMINISTRATOR" },
    });

    let isNewAdmin = false;
    let adminId: string;
    let email: string;

    if (admin) {
      adminId = admin.id;
      email = admin.email;
      console.log(`🔍 Located existing Administrator account: ${email} [ID: ${adminId}]`);

      // If Admin lost access to their old email and provided a new one:
      if (requestedEmail && requestedEmail !== email) {
        console.log(`🔄 Updating Administrator email address from [${email}] to [${requestedEmail}]...`);

        // Check if new email is already used by another account
        const existingWithNewEmail = await prisma.user.findUnique({ where: { email: requestedEmail } });
        if (existingWithNewEmail && existingWithNewEmail.id !== adminId) {
          throw new Error(`Email ${requestedEmail} is already assigned to another user account.`);
        }

        // Update email in Supabase Auth
        const { error: updateEmailAuthError } = await supabase.auth.admin.updateUserById(adminId, {
          email: requestedEmail,
          email_confirm: true,
        });

        if (updateEmailAuthError) {
          throw new Error(`Failed to update email in Supabase: ${updateEmailAuthError.message}`);
        }

        // Update email in PostgreSQL DB
        await prisma.user.update({
          where: { id: adminId },
          data: { email: requestedEmail },
        });

        email = requestedEmail;
        console.log(`✅ Administrator email updated successfully to: ${email}`);
      }
    } else {
      email = requestedEmail || defaultEmail;
      console.log(`⚠️ No Administrator found in DB. Initializing primary admin: ${email}`);

      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: `Temp_${crypto.randomBytes(8).toString("hex")}!Aa1`,
        email_confirm: true,
      });

      if (createError) {
        if (createError.message.includes("already registered") || createError.message.includes("already exists")) {
          const { data: listData } = await supabase.auth.admin.listUsers();
          const existingAuth = listData.users.find((u) => u.email === email);
          if (!existingAuth) throw new Error("Admin exists in auth provider but could not be located");
          adminId = existingAuth.id;
        } else {
          throw new Error(`Failed to create admin in Supabase: ${createError.message}`);
        }
      } else {
        adminId = createData.user.id;
      }

      admin = await prisma.user.upsert({
        where: { id: adminId },
        update: {
          role: "ADMINISTRATOR",
          isActive: true,
          accountStatus: "ACTIVE",
        },
        create: {
          id: adminId,
          email,
          role: "ADMINISTRATOR",
          accountStatus: "ACTIVE",
          mustChangePassword: true,
        },
      });

      isNewAdmin = true;
    }

    // 2. Generate secure temporary password
    const tempPassword = `Recovery_${crypto.randomBytes(6).toString("hex")}!Aa1`;

    // 3. Reset password in Supabase
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(adminId, {
      password: tempPassword,
    });

    if (updateAuthError) {
      throw new Error(`Failed to update password in Supabase: ${updateAuthError.message}`);
    }

    // 4. Update local DB user: force password change and activate
    await prisma.user.update({
      where: { id: adminId },
      data: {
        isActive: true,
        accountStatus: "ACTIVE",
        mustChangePassword: true,
      },
    });

    // 5. Log audit event
    await logAudit(adminId, "EMERGENCY_ADMIN_RECOVERY", "User", adminId, {
      email,
      isNewAdmin,
      emailChanged: Boolean(requestedEmail && requestedEmail !== admin?.email),
      timestamp: new Date().toISOString(),
    });

    console.log("\n✅ RECOVERY SUCCESSFUL");
    console.log("--------------------------------------------------");
    console.log(`Admin ID:             ${adminId}`);
    console.log(`Active Admin Email:   ${email}`);
    console.log(`Temporary Password:   ${tempPassword}`);
    console.log(`mustChangePassword:   TRUE (enforced on next login)`);
    console.log("--------------------------------------------------");
    console.log("💡 Usage Tip: To assign a new Gmail, run:");
    console.log("   npx tsx scripts/admin-recover.ts --new-email=your-new-email@gmail.com");
    console.log("--------------------------------------------------");
    console.log("⚠️ Action Required: Log in immediately and update your password.");
    console.log("==================================================\n");
  } catch (err: any) {
    console.error("\n❌ EMERGENCY RECOVERY FAILED:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAdminRecovery();

