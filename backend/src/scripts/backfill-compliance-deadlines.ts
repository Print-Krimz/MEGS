import prisma from "../utils/prisma.js";

async function main() {
  const reqs = await prisma.complianceRequirement.findMany({
    where: { deadline: null },
  });

  console.log(`Found ${reqs.length} compliance requirements with null deadline.`);

  for (const r of reqs) {
    const autoDeadline = new Date(r.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    await prisma.complianceRequirement.update({
      where: { id: r.id },
      data: { deadline: autoDeadline },
    });
    console.log(`Updated req ${r.id} (${r.documentLabel}) -> deadline: ${autoDeadline.toISOString()}`);
  }

  console.log("All legacy compliance requirements have been updated with 7-day deadlines.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
