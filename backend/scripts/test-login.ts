import "dotenv/config";
import { loginUser } from "../src/services/core/auth.service.js";
import prisma from "../src/utils/prisma.js";

async function run() {
  console.log("Testing Admin login...");
  const admin = await loginUser("admin@megs-recruitment.com", "Admin123!@#");
  console.log("✅ Admin Login Success:", admin.user);

  console.log("\nTesting TA login...");
  const ta = await loginUser("ta@megs-recruitment.com", "Recruiter123!@#");
  console.log("✅ TA Login Success:", ta.user);
}

run()
  .then(() => {
    prisma.$disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Login failed:", err.message);
    prisma.$disconnect();
    process.exit(1);
  });
