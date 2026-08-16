import multer from "multer";
import supabase from "../utils/supabase.js";
import { v4 as uuidv4 } from "uuid";
import prisma from "../utils/prisma.js";

// In-memory storage allows direct buffer streaming to Supabase Storage. Max 5MB.
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPEG, and PNG are allowed.'));
    }
  },
});

// Uploads buffer to Supabase bucket and registers a StoredDocument metadata record.
// Returns internal download proxy route rather than exposing direct bucket URL.
const verifiedBuckets = new Set<string>();

export const ensureBucketExists = async (bucket: string): Promise<void> => {
  if (verifiedBuckets.has(bucket)) return;
  try {
    const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
    if (!listErr) {
      const exists = (buckets || []).some((b) => (b.id || b.name) === bucket);
      if (!exists) {
        await supabase.storage.createBucket(bucket, {
          public: false,
          fileSizeLimit: 10 * 1024 * 1024,
          allowedMimeTypes: [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ],
        });
      }
      verifiedBuckets.add(bucket);
    }
  } catch (err) {
    console.warn(`[Storage] Auto-bucket provisioning warning for '${bucket}':`, err);
  }
};

export const uploadFileToSupabase = async (
  bucket: string,
  folder: string,
  file: Express.Multer.File
): Promise<string> => {
  await ensureBucketExists(bucket);

  const extension = file.originalname.split(".").pop();
  const filename = `${folder}/${uuidv4()}.${extension}`;

  let { data, error } = await supabase.storage
    .from(bucket)
    .upload(filename, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  // Self-healing: If bucket was not found, attempt explicit creation and retry once
  if (error && (error.message?.toLowerCase().includes("bucket not found") || (error as any).statusCode === "404")) {
    console.warn(`[Storage] Bucket '${bucket}' not found during upload. Auto-creating and retrying...`);
    await supabase.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
    });
    verifiedBuckets.add(bucket);

    const retryResult = await supabase.storage
      .from(bucket)
      .upload(filename, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });
    data = retryResult.data;
    error = retryResult.error;
  }

  if (error) {
    console.error("Supabase Storage Error:", error);
    throw new Error(`Failed to upload file to Supabase: ${error.message}`);
  }

  const doc = await prisma.storedDocument.create({
    data: {
      ownerId: folder,
      category: "ASSET",
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      sha256: "",
      storageBucket: bucket,
      storagePath: filename,
    }
  });

  return `/api/documents/${doc.id}/download`;
};
