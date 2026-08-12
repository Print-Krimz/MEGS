import prisma from "../src/utils/prisma.js";
import { featureDocument, readFeatureInput } from "../src/services/scoring/talent-pool-knn.service.js";
import { generateEmbedding } from "../src/services/scoring/embedding.service.js";

async function main() {
  console.log("Starting Candidate Feature Profile embedding migration...");
  const profiles = await prisma.candidateFeatureProfile.findMany({
    select: { id: true, rawFeatures: true, applicantProfileId: true },
  });

  console.log(`Found ${profiles.length} profiles to process.`);

  let updatedCount = 0;
  for (const profile of profiles) {
    try {
      const features = readFeatureInput(profile.rawFeatures);
      const text = featureDocument(features);
      const embedding = await generateEmbedding(text);
      const vectorStr = `[${embedding.join(",")}]`;

      await prisma.$executeRaw`
        UPDATE "CandidateFeatureProfile"
        SET embedding = ${vectorStr}::vector
        WHERE id = ${profile.id}
      `;
      updatedCount++;
      if (updatedCount % 10 === 0 || updatedCount === profiles.length) {
        console.log(`Migrated ${updatedCount}/${profiles.length} profiles...`);
      }
    } catch (err) {
      console.error(`Failed to migrate profile ID ${profile.id}:`, err);
    }
  }

  console.log(`Embedding migration completed successfully. ${updatedCount} profiles updated.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
