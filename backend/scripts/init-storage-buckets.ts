import supabase from "../src/utils/supabase.js";

const REQUIRED_BUCKETS = [
  { id: "applicant-assets", public: false },
  { id: "documents", public: false },
];

async function initBuckets() {
  console.log("Checking Supabase Storage buckets...");

  const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error("Failed to list buckets:", listError);
    process.exit(1);
  }

  const existingBucketIds = new Set((existingBuckets || []).map((b) => b.id || b.name));
  console.log("Existing buckets:", Array.from(existingBucketIds));

  for (const bucket of REQUIRED_BUCKETS) {
    if (!existingBucketIds.has(bucket.id)) {
      console.log(`Creating bucket '${bucket.id}'...`);
      const { data, error } = await supabase.storage.createBucket(bucket.id, {
        public: bucket.public,
        fileSizeLimit: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
      });

      if (error) {
        console.error(`Failed to create bucket '${bucket.id}':`, error);
      } else {
        console.log(`✅ Successfully created bucket '${bucket.id}'!`);
      }
    } else {
      console.log(`Bucket '${bucket.id}' already exists.`);
    }
  }

  console.log("Storage bucket initialization complete.");
}

initBuckets().catch((err) => {
  console.error("Storage bucket init failed with error:", err);
  process.exit(1);
});
