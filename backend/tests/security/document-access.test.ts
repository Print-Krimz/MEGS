import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
const mocks = vi.hoisted(() => ({ unique: vi.fn(), first: vi.fn(), sign: vi.fn(), buckets: vi.fn(), download: vi.fn() }));
vi.mock("../../src/utils/prisma.js", () => ({ default: { storedDocument: { findUnique: mocks.unique, findFirst: mocks.first } } }));
vi.mock("../../src/utils/supabase.js", () => ({ default: { storage: { listBuckets: mocks.buckets, createBucket: vi.fn(), from: vi.fn(() => ({ createSignedUrl: mocks.sign, download: mocks.download })) } } }));
vi.mock("../../src/utils/gemini.js", () => ({ analyzeResume: vi.fn(), analyzeResumeFromBuffer: vi.fn() }));
vi.mock("../../src/utils/notification.js", () => ({ sendNotification: vi.fn(), sendRoleNotification: vi.fn() }));
import { getDocumentDownloadUrl, getDocumentPreview, resolveDocumentSignedUrl } from "../../src/services/document/document.service.js";
import { acquireUploadSlot, upload } from "../../src/middleware/upload.middleware.js";
import { fetchResumePayload } from "../../src/workers/resume.worker.js";
import express from "express";
import request from "supertest";

const document = { id: 1, ownerId: "owner", storageBucket: "private-documents", storagePath: "owner/resume.pdf", sizeBytes: 100, mimeType: "application/pdf", originalName: "resume.pdf" };
describe("private document authorization across access paths", () => {
  beforeEach(() => {
    mocks.unique.mockResolvedValue(document); mocks.first.mockResolvedValue(document);
    mocks.buckets.mockResolvedValue({ data: [{ id: "private-documents", public: false }], error: null });
    mocks.sign.mockResolvedValue({ data: { signedUrl: "https://private.example.com/signed" }, error: null }); mocks.sign.mockClear();
    mocks.download.mockResolvedValue({ data: new Blob(["%PDF-1.4\n%%EOF"]), error: null }); mocks.download.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());
  it("denies cross-applicant download, preview, ID and stored-path resolution", async () => {
    await expect(getDocumentDownloadUrl(1, "other", "APPLICANT")).rejects.toThrow("Unauthorized");
    await expect(getDocumentPreview(1, "other", "APPLICANT")).rejects.toThrow("Unauthorized");
    await expect(resolveDocumentSignedUrl("/api/documents/1/download", "other")).rejects.toThrow("Unauthorized");
    await expect(resolveDocumentSignedUrl("owner/resume.pdf", "other")).rejects.toThrow("Unauthorized");
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("preserves applicant self access, global TA/admin review and bounded signed lifetimes", async () => {
    expect(await getDocumentDownloadUrl(1, "owner", "APPLICANT")).toContain("signed");
    expect(mocks.sign.mock.calls[0][1]).toBe(60);
    await getDocumentPreview(1, "staff", "TALENT_ACQUISITION"); expect(mocks.sign.mock.calls[1][1]).toBe(300);
    await resolveDocumentSignedUrl("1", "staff", "ADMINISTRATOR", 999_999); expect(mocks.sign.mock.calls[2][1]).toBe(900);
  });
  it("fails closed for deleted references and malformed route variations", async () => {
    mocks.unique.mockResolvedValue(null); mocks.first.mockResolvedValue(null);
    for (const path of ["1", "/api/documents/1/download/extra", "/else/api/documents/1", "1junk"]) await expect(resolveDocumentSignedUrl(path, "owner")).rejects.toThrow("not found");
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("binds worker internal references to the applicant owner before privileged storage download", async () => {
    await expect(fetchResumePayload("/api/documents/1/download", "other")).rejects.toThrow();
    await expect(fetchResumePayload("/api/documents/1/download")).rejects.toThrow();
    expect(mocks.download).not.toHaveBeenCalled();
    expect((await fetchResumePayload("/api/documents/1/download", "owner")).buffer.length).toBeGreaterThan(0);
  });
  it("checks public bucket state before producing any signed URL", async () => {
    mocks.unique.mockResolvedValue({ ...document, storageBucket: "unexpected-public-bucket" });
    mocks.buckets.mockResolvedValue({ data: [{ id: "unexpected-public-bucket", public: true }], error: null });
    await expect(getDocumentDownloadUrl(1, "owner", "APPLICANT")).rejects.toThrow("private");
    expect(mocks.sign).not.toHaveBeenCalled();
  });
});

describe("upload boundary before controller work", () => {
  it("rejects a mislabeled multipart file before invoking the handler", async () => {
    const app = express(); const handler = vi.fn();
    app.post("/upload", upload.single("file"), (_req, res) => { handler(); res.json({ success: true }); });
    const result = await request(app).post("/upload").attach("file", Buffer.from("not a PDF"), { filename: "resume.pdf", contentType: "application/pdf" });
    expect(result.status).toBe(400); expect(handler).not.toHaveBeenCalled();
  });
  it("caps concurrently buffered requests and frees a slot once on close/finish", () => {
    const responses = Array.from({ length: 5 }, () => Object.assign(new EventEmitter(), { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() }));
    const next = vi.fn();
    for (const response of responses) acquireUploadSlot({} as any, response as any, next);
    expect(next).toHaveBeenCalledTimes(4); expect(responses[4]!.status).toHaveBeenCalledWith(429);
    for (const response of responses) { response.emit("close"); response.emit("finish"); }
    const retry = Object.assign(new EventEmitter(), { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() });
    acquireUploadSlot({} as any, retry as any, next); expect(next).toHaveBeenCalledTimes(5); retry.emit("finish");
  });
});
