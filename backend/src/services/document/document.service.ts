import prisma from "../../utils/prisma.js";
import supabase from "../../utils/supabase.js";
import { ensureBucketExists } from "../../middleware/upload.middleware.js";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

export const uploadAndStoreDocument = async (
  userId: string,
  category: "RESUME" | "PHOTO" | "ASSET" | "POST_HIRE" | "VAULT_201",
  file: Express.Multer.File,
  applicationId?: number,
  profileId?: number
) => {
  const BUCKET = "documents";
  await ensureBucketExists(BUCKET);

  const extension = file.originalname.split(".").pop();
  const storagePath = `${userId}/${category.toLowerCase()}/${uuidv4()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    console.error("Supabase Storage Error:", error);
    throw new Error(`Failed to upload file to Supabase: ${error.message}`);
  }

  const sha256 = crypto.createHash("sha256").update(file.buffer).digest("hex");

  const doc = await prisma.storedDocument.create({
    data: {
      ownerId: userId,
      category,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      sha256,
      storageBucket: BUCKET,
      storagePath,
      applicationId,
      profileId,
    },
  });

  return `/api/documents/${doc.id}/download`;
};

// Generates short-lived (60s) signed URL for document owner or TA/Admin staff.
export const getDocumentDownloadUrl = async (documentId: number, requesterId: string, requesterRole: string) => {
  const doc = await prisma.storedDocument.findUnique({
    where: { id: documentId }
  });

  if (!doc) {
    throw new Error("Document not found");
  }

  if (doc.ownerId !== requesterId && requesterRole !== "TALENT_ACQUISITION" && requesterRole !== "ADMINISTRATOR") {
    throw new Error("Unauthorized to access this document");
  }

  const { data, error } = await supabase.storage
    .from(doc.storageBucket)
    .createSignedUrl(doc.storagePath, 60);

  if (error || !data) {
    throw new Error("Failed to generate download URL");
  }

  return data.signedUrl;
};

// Generates short-lived (300s) signed URL and metadata for document preview modal.
export const getDocumentPreview = async (documentId: number, requesterId: string, requesterRole: string) => {
  const doc = await prisma.storedDocument.findUnique({
    where: { id: documentId },
    include: {
      owner: {
        select: {
          id: true,
          email: true,
          applicantProfile: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!doc) {
    throw new Error("Document not found");
  }

  if (doc.ownerId !== requesterId && requesterRole !== "TALENT_ACQUISITION" && requesterRole !== "ADMINISTRATOR") {
    throw new Error("Unauthorized to access this document");
  }

  const { data, error } = await supabase.storage
    .from(doc.storageBucket)
    .createSignedUrl(doc.storagePath, 300);

  if (error || !data) {
    throw new Error("Failed to generate download URL");
  }

  const applicantName = doc.owner?.applicantProfile
    ? `${doc.owner.applicantProfile.firstName} ${doc.owner.applicantProfile.lastName}`.trim()
    : undefined;

  return {
    id: doc.id,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    category: doc.category,
    uploadedAt: doc.uploadedAt,
    applicantName,
    applicantEmail: doc.owner?.email,
    url: data.signedUrl,
  };
};

