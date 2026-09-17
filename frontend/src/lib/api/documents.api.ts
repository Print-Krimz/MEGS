import { api } from "./client";

export interface DocumentPreviewResponse {
  id: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  uploadedAt: string;
  applicantName?: string;
  applicantEmail?: string;
  url: string;
}

export const documentsApi = {
  getDownloadUrl: (id: number | string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    return token
      ? `/api/documents/${id}/download?token=${encodeURIComponent(token)}`
      : `/api/documents/${id}/download`;
  },
  getPreview: (id: number | string) =>
    api.get<DocumentPreviewResponse>(`/api/documents/${id}/preview`),
};

