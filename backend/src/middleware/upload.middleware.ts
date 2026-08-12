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
export const uploadFileToSupabase = async (
  bucket: string,
  folder: string,
  file: Express.Multer.File
): Promise<string> => {
  const extension = file.originalname.split(".").pop();
  const filename = `${folder}/${uuidv4()}.${extension}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filename, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

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
