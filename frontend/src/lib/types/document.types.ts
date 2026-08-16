import type { DocumentCategory } from "./enums";

export interface StoredDocument {
  id: number;
  ownerId: string;
  category: DocumentCategory;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256?: string | null;
  storageBucket: string;
  storagePath: string;
  uploadedAt: string;
  deletedAt?: string | null;
  applicationId?: number | null;
  profileId?: number | null;
}
