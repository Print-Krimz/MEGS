import multer from "multer";
import supabase from "../utils/supabase.js";
import { v4 as uuidv4 } from "uuid";
import prisma from "../utils/prisma.js";
import type { RequestHandler } from "express";
import { createHash } from "node:crypto";
import { publicMessages, CHECK_IN_BIODATA_MESSAGE } from "../security/public-messages.js";
import { validateDocumentBytes, MAX_DOCUMENT_BYTES, MAX_CONTRACT_SCAN_BYTES, sanitizeUploadFileName } from "../security/file-validation.js";

// In-memory storage allows direct buffer streaming to Supabase Storage. Max 5MB.
const storage = multer.memoryStorage();

const allowedMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

const documentFileFilter: multer.Options["fileFilter"] = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(Object.assign(new Error('Invalid file type. Only PDF, DOCX, DOC, JPEG, PNG, and WEBP files are allowed.'), { status: 400 }));
  }
};

const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

const imageFileFilter: multer.Options["fileFilter"] = (req, file, cb) => {
  if (imageMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(Object.assign(new Error('Invalid file type. Only JPEG, PNG, and WEBP images are allowed.'), { status: 400 }));
  }
};

const documentUpload = (fileSize: number, fileFilter: multer.Options["fileFilter"]) => multer({
  storage,
  limits: { fileSize, files: 1, fields: 20, fieldSize: 64 * 1024, parts: 21 },
  fileFilter,
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
const guardedUpload = (maxBytes: number, fileFilter: multer.Options["fileFilter"] = documentFileFilter, rejectMessage?: string) => {
  const parser = documentUpload(maxBytes, fileFilter);
  return {
    single(field: string): RequestHandler {
      const parse = parser.single(field);
      return (req, res, next) => acquireUploadSlot(req, res, () => {
        parse(req, res, (error) => {
          if (error) { const message = rejectMessage ?? (error instanceof Error && publicMessages.has(error.message) ? error.message : "Upload failed. Check the document type, size and number of files."); res.status(400).json({ success: false, message }); return; }
          try { if (req.file) validateDocumentBytes(req.file.buffer, req.file.mimetype, maxBytes); }
          catch { res.status(400).json({ success: false, message: rejectMessage ?? "File contents do not match a supported document type or size." }); return; }
          next();
        });
      });
    },
  };
};

export const upload = guardedUpload(MAX_DOCUMENT_BYTES);

// Signed contract scans are often phone photos of a full page, so they get a larger limit (10MB).
export const uploadContractScan = guardedUpload(MAX_CONTRACT_SCAN_BYTES);

// Profile photos accept only JPEG, PNG and WEBP, so a PDF or Word file cannot be stored as a photo.
export const uploadImage = guardedUpload(MAX_DOCUMENT_BYTES, imageFileFilter);

// Public self check-in biodata: a photo or PDF only (no Word files), with one plain message for every rejection.
export const uploadCheckInBiodata = guardedUpload(
  MAX_DOCUMENT_BYTES,
  (_req, file, cb) => {
    if ([...imageMimeTypes, "application/pdf"].includes(file.mimetype)) cb(null, true);
    else cb(new Error(CHECK_IN_BIODATA_MESSAGE));
  },
  CHECK_IN_BIODATA_MESSAGE,
);

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
          allowedMimeTypes,
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
      allowedMimeTypes,
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
      originalName: sanitizeUploadFileName(file.originalname),
      mimeType: file.mimetype,
      sizeBytes: file.size,
      sha256: createHash("sha256").update(file.buffer).digest("hex"),
      storageBucket: bucket,
      storagePath: filename,
    }
  });

  return `/api/documents/${doc.id}/download`;
};
