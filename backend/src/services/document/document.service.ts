import prisma from "../../utils/prisma.js";
import supabase from "../../utils/supabase.js";
import { uploadFileToSupabase } from "../../middleware/upload.middleware.js";
import crypto from "crypto";

export const uploadAndStoreDocument = async (
  userId: string,
  category: "RESUME" | "PHOTO" | "ASSET" | "POST_HIRE" | "VAULT_201",
  file: Express.Multer.File,
  applicationId?: number,
  profileId?: number
) => {
  const BUCKET = "documents";
  
  const storagePath = await uploadFileToSupabase(BUCKET, `${userId}/${category.toLowerCase()}`, file);

  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');

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
      profileId
    }
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
