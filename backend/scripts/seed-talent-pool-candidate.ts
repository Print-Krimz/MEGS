import "dotenv/config";
import prisma from "../src/utils/prisma.js";
import { rebuildCandidateFeatureProfile, addToTalentPool } from "../src/services/scoring/talent-pool-knn.service.js";

async function main() {
  console.log("🌱 Creating test talent pool candidates for verification...");

  const taUser = await prisma.user.findFirstOrThrow({ where: { role: "TALENT_ACQUISITION" } });

  // 1. Create candidate User & ApplicantProfile
  const candUser = await prisma.user.upsert({
    where: { email: "carlos.mendoza@example.com" },
    update: { role: "APPLICANT", isActive: true, accountStatus: "ACTIVE" },
    create: {
      id: "cand-carlos-mendoza-001",
      email: "carlos.mendoza@example.com",
      role: "APPLICANT",
      isActive: true,
      accountStatus: "ACTIVE",
    },
  });

  const profile = await prisma.applicantProfile.upsert({
    where: { userId: candUser.id },
    update: {
      firstName: "Carlos",
      lastName: "Mendoza",
      city: "Makati",
      province: "Metro Manila",
      mobileNumber: "09171234567",
      isActive: true,
    },
    create: {
      userId: candUser.id,
      firstName: "Carlos",
      lastName: "Mendoza",
      city: "Makati",
      province: "Metro Manila",
      mobileNumber: "09171234567",
      isActive: true,
    },
  });

  // Skills
  const skillNames = ["TypeScript", "React", "Node.js", "PostgreSQL", "Tailwind CSS"];
  for (const name of skillNames) {
    const s = await prisma.skill.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    await prisma.applicantSkill.upsert({
      where: { applicantProfileId_skillId: { applicantProfileId: profile.id, skillId: s.id } },
      update: {},
      create: { applicantProfileId: profile.id, skillId: s.id },
    });
  }

  // Work Experience
  await prisma.workExperience.deleteMany({ where: { applicantProfileId: profile.id } });
  await prisma.workExperience.create({
    data: {
      applicantProfileId: profile.id,
      company: "Acme Software PH",
      roleTitle: "Senior TypeScript Engineer",
      startDate: new Date("2021-01-01"),
      isCurrent: true,
      summary: "Developing React frontends and Node.js microservices with PostgreSQL.",
    },
  });

  // Rebuild feature profile and embedding
  console.log("⚙️ Generating feature embedding vector...");
  await rebuildCandidateFeatureProfile(profile.id);

  // Add to Talent Pool Membership
  const membership = await addToTalentPool({
    applicantProfileId: profile.id,
    addedById: taUser.id,
    availability: "AVAILABLE",
    notes: "High potential senior engineer retained in talent pool",
  });

  console.log("✅ Seeded candidate Carlos Mendoza in Talent Pool Membership:", membership.id);
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
