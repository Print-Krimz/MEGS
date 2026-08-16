import "dotenv/config";
import prisma from "../src/utils/prisma.js";
import supabase from "../src/utils/supabase.js";

async function setup() {
  const users = [
    { email: "admin@megs-recruitment.com", password: "AdminPassword123!", role: "ADMINISTRATOR", name: "System Administrator" },
    { email: "ta@megs-recruitment.com", password: "TAPassword123!", role: "TALENT_ACQUISITION", name: "Talent Acquisition" }
  ];

  for (const u of users) {
    const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) {
      console.error("List error:", listErr);
      continue;
    }
    const existing = listData?.users.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());
    let uid: string;
    if (existing) {
      uid = existing.id;
      const { error: updErr } = await supabase.auth.admin.updateUserById(uid, {
        password: u.password,
        email_confirm: true,
        user_metadata: { role: u.role, name: u.name }
      });
      if (updErr) console.error("Update error:", u.email, updErr.message);
      else console.log(`✅ Updated Supabase Auth: ${u.email} (${uid})`);
    } else {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { role: u.role, name: u.name }
      });
      if (error || !created.user) {
        console.error("Error creating:", u.email, error?.message);
        continue;
      }
      uid = created.user.id;
      console.log(`✅ Created Supabase Auth: ${u.email} (${uid})`);
    }

    if (uid) {
      await prisma.user.upsert({
        where: { id: uid },
        update: { email: u.email, role: u.role as any, isActive: true, accountStatus: "ACTIVE", mustChangePassword: false },
        create: { id: uid, email: u.email, role: u.role as any, isActive: true, accountStatus: "ACTIVE", mustChangePassword: false }
      });
      console.log(`✅ Upserted Prisma User: ${u.email}`);
    }
  }
}

setup()
  .then(() => {
    console.log("All accounts configured!");
    prisma.$disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error("Setup error:", err);
    prisma.$disconnect();
    process.exit(1);
  });
