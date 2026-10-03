import multer from "multer";
import supabase from "../utils/supabase.js";
import { v4 as uuidv4 } from "uuid";
import prisma from "../utils/prisma.js";
import type { RequestHandler } from "express";
import { validateDocumentBytes } from "../security/file-validation.js";

// In-memory storage allows direct buffer streaming to Supabase Storage. Max 5MB.
const storage = multer.memoryStorage();

const documentUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 20, fieldSize: 64 * 1024, parts: 21 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Invalid file type. Only PDF, DOCX, DOC, JPEG, PNG, and WEBP files are allowed.'), { status: 400 }));
    }
  },
});

let bufferedUploads = 0;
export const acquireUploadSlot: RequestHandler = (_req, res, next) => {
  if (bufferedUploads >= 4) {
    res.setHeader("Retry-After", "5");
    res.status(429).json({ success: false, message: "Uploads are busy. Please retry shortly." });
    return;
  }
  bufferedUploads++;
  let released = false;
  const release = () => { if (!released) { released = true; bufferedUploads--; } };
  res.once("finish", release);
  res.once("close", release);
  next();
};

// Existing routes all use single(). Validate the completed buffer before any
// controller/storage side effect, and reserve memory before multer buffers it.
export const upload = {
  single(field: string): RequestHandler {
    const parse = documentUpload.single(field);
    return (req, res, next) => acquireUploadSlot(req, res, () => {
      parse(req, res, (error) => {
        if (error) { res.status(400).json({ success: false, message: "Upload failed. Check the document type, size and number of files." }); return; }
        try { if (req.file) validateDocumentBytes(req.file.buffer, req.file.mimetype); }
        catch { res.status(400).json({ success: false, message: "File contents do not match a supported document type or size." }); return; }
        next();
      });
    });
  },
};

// Uploads buffer to Supabase bucket and registers a StoredDocument metadata record.
// Returns internal download proxy route rather than exposing direct bucket URL.
const verifiedBuckets = new Set<string>();

export const ensureBucketExists = async (bucket: string): Promise<void> => {
  if (verifiedBuckets.has(bucket)) return;
    const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
    if (listErr) throw new Error("Unable to verify private document storage");
      const existing = (buckets || []).find((b) => (b.id || b.name) === bucket);
      if (existing?.public) throw new Error("Document storage bucket must be private");
      if (!existing) {
        const { error: createError } = await supabase.storage.createBucket(bucket, {
          public: false,
          fileSizeLimit: 10 * 1024 * 1024,
          allowedMimeTypes: [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
          ],
        });
        if (createError) throw new Error("Unable to create private document storage");
      }
      verifiedBuckets.add(bucket);
};

export const uploadFileToSupabase = async (
  bucket: string,
  folder: string,
  file: Express.Multer.File
): Promise<string> => {
  const validated = validateDocumentBytes(file.buffer, file.mimetype);
  await ensureBucketExists(bucket);

  const extension = validated.extension;
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
