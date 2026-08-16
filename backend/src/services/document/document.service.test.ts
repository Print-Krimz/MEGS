import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    storedDocument: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
  supabase: {
    storage: {
      listBuckets: vi.fn(),
      createBucket: vi.fn(),
      from: vi.fn(),
    },
  },
}));

vi.mock("../../utils/prisma.js", () => ({ default: mocks.prisma }));
vi.mock("../../utils/supabase.js", () => ({ default: mocks.supabase }));

import { uploadAndStoreDocument, getDocumentDownloadUrl } from "./document.service.js";

describe("Document Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads file to Supabase and saves actual storagePath in StoredDocument record", async () => {
    mocks.supabase.storage.listBuckets.mockResolvedValue({ data: [{ id: "documents" }], error: null });
    const mockUpload = vi.fn().mockResolvedValue({ data: { path: "user1/resume/mock.pdf" }, error: null });
    mocks.supabase.storage.from.mockReturnValue({
      upload: mockUpload,
    });

    mocks.prisma.storedDocument.create.mockResolvedValueOnce({
      id: 77,
      ownerId: "user1",
      storageBucket: "documents",
      storagePath: "user1/resume/mock.pdf",
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

    const downloadUrl = await uploadAndStoreDocument("user1", "RESUME", mockFile);

    expect(downloadUrl).toBe("/api/documents/77/download");
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^user1\/resume\/[a-f0-9-]+\.pdf$/),
      mockFile.buffer,
      expect.objectContaining({ contentType: "application/pdf" })
    );

    expect(mocks.prisma.storedDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "user1",
        category: "RESUME",
        storageBucket: "documents",
        storagePath: expect.stringMatching(/^user1\/resume\/[a-f0-9-]+\.pdf$/),
      }),
    });
  });

  it("generates signed URL for document owner", async () => {
    mocks.prisma.storedDocument.findUnique.mockResolvedValueOnce({
      id: 77,
      ownerId: "user1",
      storageBucket: "documents",
      storagePath: "user1/resume/test.pdf",
    });

    const mockCreateSignedUrl = vi.fn().mockResolvedValueOnce({
      data: { signedUrl: "https://supabase.co/signed/user1/resume/test.pdf" },
      error: null,
    });

    mocks.supabase.storage.from.mockReturnValueOnce({
      createSignedUrl: mockCreateSignedUrl,
    });

    const url = await getDocumentDownloadUrl(77, "user1", "APPLICANT");

    expect(url).toBe("https://supabase.co/signed/user1/resume/test.pdf");
    expect(mockCreateSignedUrl).toHaveBeenCalledWith("user1/resume/test.pdf", 60);
  });
});
