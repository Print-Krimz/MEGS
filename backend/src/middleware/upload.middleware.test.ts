import { describe, expect, it, vi, beforeEach } from "vitest";

const mockListBuckets = vi.fn();
const mockCreateBucket = vi.fn();
const mockUpload = vi.fn();
const mockCreateStoredDocument = vi.fn();

vi.mock("../utils/supabase.js", () => ({
  default: {
    storage: {
      listBuckets: (...args: any[]) => mockListBuckets(...args),
      createBucket: (...args: any[]) => mockCreateBucket(...args),
      from: vi.fn(() => ({
        upload: (...args: any[]) => mockUpload(...args),
      })),
    },
  },
}));

vi.mock("../utils/prisma.js", () => ({
  default: {
    storedDocument: {
      create: (...args: any[]) => mockCreateStoredDocument(...args),
    },
  },
}));

import { uploadFileToSupabase, ensureBucketExists } from "./upload.middleware.js";

describe("Upload Middleware & Supabase Bucket Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates the bucket if listBuckets reports it is missing", async () => {
    mockListBuckets.mockResolvedValueOnce({ data: [{ id: "other-bucket" }], error: null });
    mockCreateBucket.mockResolvedValueOnce({ data: { name: "test-bucket" }, error: null });

    await ensureBucketExists("test-bucket");

    expect(mockListBuckets).toHaveBeenCalled();
    expect(mockCreateBucket).toHaveBeenCalledWith(
      "test-bucket",
      expect.objectContaining({ public: false })
    );
  });

  it("does not recreate the bucket if it already exists in Supabase", async () => {
    mockListBuckets.mockResolvedValueOnce({ data: [{ id: "existing-bucket" }], error: null });

    await ensureBucketExists("existing-bucket");

    expect(mockListBuckets).toHaveBeenCalled();
    expect(mockCreateBucket).not.toHaveBeenCalled();
  });

  it("successfully uploads file and records StoredDocument metadata", async () => {
    mockListBuckets.mockResolvedValue({ data: [{ id: "applicant-assets" }], error: null });
    mockUpload.mockResolvedValueOnce({ data: { path: "user123/file.pdf" }, error: null });
    mockCreateStoredDocument.mockResolvedValueOnce({
      id: "doc-uuid-1234",
      storageBucket: "applicant-assets",
      storagePath: "user123/mock.pdf",
    });

    const mockFile: Express.Multer.File = {
      fieldname: "file",
      originalname: "resume.pdf",
      encoding: "7bit",
      mimetype: "application/pdf",
      size: 1024,
      buffer: Buffer.from("pdf-data"),
      stream: null as any,
      destination: "",
      filename: "",
      path: "",
    };

    const downloadUrl = await uploadFileToSupabase("applicant-assets", "user123", mockFile);

    expect(downloadUrl).toBe("/api/documents/doc-uuid-1234/download");
    expect(mockUpload).toHaveBeenCalled();
    expect(mockCreateStoredDocument).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "user123",
        originalName: "resume.pdf",
        mimeType: "application/pdf",
        storageBucket: "applicant-assets",
      }),
    });
  });

  it("self-heals and retries upload if bucket is missing at upload time", async () => {
    mockListBuckets.mockResolvedValue({ data: [{ id: "applicant-assets" }], error: null });
    mockUpload
      .mockResolvedValueOnce({ data: null, error: { message: "Bucket not found", statusCode: "404" } })
      .mockResolvedValueOnce({ data: { path: "user123/file.pdf" }, error: null });
    mockCreateBucket.mockResolvedValue({ data: { name: "applicant-assets" }, error: null });
    mockCreateStoredDocument.mockResolvedValueOnce({
      id: "doc-uuid-9999",
      storageBucket: "applicant-assets",
      storagePath: "user123/mock.pdf",
    });

    const mockFile: Express.Multer.File = {
      fieldname: "file",
      originalname: "photo.png",
      encoding: "7bit",
      mimetype: "image/png",
      size: 2048,
      buffer: Buffer.from("png-data"),
      stream: null as any,
      destination: "",
      filename: "",
      path: "",
    };

    const downloadUrl = await uploadFileToSupabase("applicant-assets", "user123", mockFile);

    expect(downloadUrl).toBe("/api/documents/doc-uuid-9999/download");
    expect(mockCreateBucket).toHaveBeenCalledWith(
      "applicant-assets",
      expect.objectContaining({ public: false })
    );
    expect(mockUpload).toHaveBeenCalledTimes(2);
  });
});
