import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import express from "express";
import request from "supertest";

// Public self check-in from the MEGS poster QR, through the real public router over HTTP.
// No login: every failure on the status link must be the same 404 with no-store and no-referrer headers,
// and the tracker must never carry contact details. The database and side-effecting dependencies are mocked.
// The rate limiter is bypassed here so the tests do not share a per-IP quota; it is not what is under test.
const m = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    prisma: {
      jobPosting: { findMany: fn(), findUnique: fn(), count: fn() },
      walkInCheckIn: { findUnique: fn(), findFirst: fn(), findMany: fn(), create: fn(), aggregate: fn(), update: fn(), updateMany: fn() },
      application: { findUnique: fn(), create: fn(), update: fn(), count: fn() },
      talentPoolInvitation: { findUnique: fn(), update: fn(), updateMany: fn() },
      deployment: { findFirst: fn(), findMany: fn() },
      recruiterDecision: { create: fn() },
      talentPoolContact: { create: fn() },
      talentPoolMembership: { update: fn() },
      $transaction: fn(),
    } as Record<string, any>,
    logAudit: fn(),
    sendNotification: fn(),
    calculateAndPersistCandidateScore: fn(),
  };
});

vi.mock("../../src/utils/prisma.js", () => ({ default: m.prisma }));
const storage = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn() }));
vi.mock("../../src/utils/supabase.js", () => ({ default: { auth: { admin: {} }, storage: { from: () => storage } } }));
vi.mock("../../src/middleware/upload.middleware.js", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  uploadFileToSupabase: vi.fn(),
  ensureBucketExists: vi.fn(),
}));
vi.mock("../../src/middleware/rate-limiter.middleware.js", () => ({
  publicLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  streamFailureLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../../src/utils/audit.js", () => ({ logAudit: m.logAudit }));
vi.mock("../../src/utils/notification.js", () => ({ sendNotification: m.sendNotification, sendRoleNotification: vi.fn() }));
vi.mock("../../src/workers/resume.worker.js", () => ({ enqueueResumeAnalysis: vi.fn(), trackFitRevalidation: vi.fn() }));
vi.mock("../../src/services/scoring/scoring-configuration.service.js", () => ({ revalidateApplication: vi.fn() }));
vi.mock("../../src/services/applicant/application.service.js", () => ({ assertCanApply: vi.fn(), resolveInitialStatus: vi.fn() }));
vi.mock("../../src/services/scoring/candidate-scoring.service.js", () => ({
  calculateAndPersistCandidateScore: m.calculateAndPersistCandidateScore,
}));
vi.mock("../../src/services/scoring/talent-pool-knn.service.js", () => ({
  InvalidKnnRequestError: class InvalidKnnRequestError extends Error {},
}));

import publicRouter from "../../src/routes/public/public.routes.js";

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const PUBLIC_ID = "5f0c9a2e-7d1b-4c3a-9e8f-1a2b3c4d5e6f";
const UNKNOWN_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const NEW_ID = "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f";
const TOKEN = "Zr3k9x_Lp0QaVbNw2hYt7g";
const WRONG = "Wrong_token_value_1";
const NOW = new Date("2026-10-22T02:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const app = express();
app.use(express.json());
app.use("/api/public", publicRouter);

// One pending check-in and its application once confirmed, as the database would hold them.
const checkInRow = (over: Record<string, unknown> = {}) => ({
  id: 1,
  publicId: PUBLIC_ID,
  queueSeq: 1,
  status: "PENDING",
  firstName: "Juan",
  middleName: "Santos",
  lastName: "Dela Cruz",
  mobileNumber: "+639171234567",
  birthDate: new Date("1990-05-09T00:00:00Z"),
  jobPostingId: 5,
  jobPosting: { title: "Forklift Operator" },
  viewTokenHash: sha256(TOKEN),
  createdAt: NOW,
  expiresAt: new Date(NOW.getTime() + 3 * DAY),
  applicationId: null as number | null,
  ...over,
});

const trackingApplication = () => ({
  id: 42,
  trackingCode: "WLK-2026-0042",
  trackingTokenHash: null,
  status: "SUBMITTED",
  createdAt: NOW,
  updatedAt: NOW,
  user: {
    applicantProfile: { firstName: "Juan", lastName: "Dela Cruz", mobileNumber: "09171234567", dateOfBirth: new Date("1990-05-09") },
  },
  jobPosting: { title: "Forklift Operator", location: "Cebu City", mrf: { client: { name: "Acme Logistics" } } },
  interviews: [],
});

let rows: Map<string, Record<string, any>>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  rows = new Map([[PUBLIC_ID, checkInRow()]]);

  m.prisma.walkInCheckIn.findUnique.mockImplementation(async ({ where }: any) => {
    if (!where.publicId) return null;
    return rows.get(where.publicId) ?? null;
  });
  m.prisma.application.findUnique.mockImplementation(async ({ where }: any) => (where.id === 42 ? trackingApplication() : null));
  m.prisma.jobPosting.findMany.mockResolvedValue([
    { id: 5, title: "Forklift Operator", location: "Cebu City", mrf: { client: { name: "Acme Logistics" } } },
  ]);
  m.prisma.jobPosting.findUnique.mockImplementation(async ({ where }: any) =>
    where.id === 5 ? { status: "OPEN" } : where.id === 6 ? { status: "CLOSED" } : null
  );
  m.prisma.walkInCheckIn.findMany.mockResolvedValue([]);
  m.prisma.walkInCheckIn.aggregate.mockResolvedValue({ _max: { queueSeq: null } });
  m.prisma.walkInCheckIn.create.mockResolvedValue({ publicId: NEW_ID, queueSeq: 1 });
  m.logAudit.mockResolvedValue(undefined);
  m.sendNotification.mockResolvedValue(undefined);
  storage.upload.mockResolvedValue({ data: {}, error: null });
  storage.remove.mockResolvedValue({ data: [], error: null });
});

afterEach(() => {
  vi.useRealTimers();
});

const expectHardened = (res: request.Response) => {
  expect(res.headers["cache-control"]).toBe("no-store");
  expect(res.headers["referrer-policy"]).toBe("no-referrer");
};

const validBody = (over: Record<string, unknown> = {}) => ({
  jobPostingId: 5,
  firstName: "Juan",
  middleName: "Santos",
  lastName: "Dela Cruz",
  mobileNumber: "09171234567",
  birthDate: "1990-05-09",
  ...over,
});

// Birth date that completes `years` on the pinned day (2026-10-22), shifted by `days`.
const birthdayFor = (years: number, days = 0) => new Date(Date.UTC(2026 - years, 9, 22 + days)).toISOString().slice(0, 10);

describe("GET /api/public/check-in/jobs", () => {
  it("lists open jobs with no-store headers, and only the four public fields", async () => {
    const res = await request(app).get("/api/public/check-in/jobs");
    expect(res.status).toBe(200);
    expectHardened(res);
    expect(res.body.data.jobs).toEqual([{ id: 5, title: "Forklift Operator", location: "Cebu City", clientName: "Acme Logistics" }]);
  });

  it("answers 404 with no-store when the job query fails, rather than leaking a server error", async () => {
    m.prisma.jobPosting.findMany.mockRejectedValueOnce(new Error("connection reset"));
    const res = await request(app).get("/api/public/check-in/jobs");
    expect(res.status).toBe(404);
    expectHardened(res);
    expect(JSON.stringify(res.body)).not.toContain("connection reset");
  });
});

describe("GET /api/public/check-in/:publicId", () => {
  const status = (publicId: string, token: string | null) =>
    request(app).get(`/api/public/check-in/${publicId}${token === null ? "" : `?token=${encodeURIComponent(token)}`}`);

  it("answers 200 with the queue view for the right link, with no-store and no-referrer", async () => {
    const res = await status(PUBLIC_ID, TOKEN);
    expect(res.status).toBe(200);
    expectHardened(res);
    expect(Object.keys(res.body.data).sort()).toEqual(["createdAt", "expiresAt", "firstName", "jobTitle", "queueNumber", "status", "tracking"]);
    expect(res.body.data).toMatchObject({ queueNumber: "A-001", status: "PENDING", tracking: null });
  });

  it("answers the same 404 for a wrong token, an unknown check-in, a malformed id and a missing token", async () => {
    const wrong = await status(PUBLIC_ID, WRONG);
    const unknown = await status(UNKNOWN_ID, TOKEN);
    const malformed = await status("not-a-uuid", TOKEN);
    const missing = await status(PUBLIC_ID, null);
    for (const res of [wrong, unknown, malformed, missing]) {
      expect(res.status).toBe(404);
      expectHardened(res);
    }
    expect(unknown.body).toEqual(wrong.body);
    expect(malformed.body).toEqual(wrong.body);
    expect(missing.body).toEqual(wrong.body);
    expect(wrong.body.success).toBe(false);
    expect(wrong.body).not.toHaveProperty("data");
  });

  it("answers 404 once a pending check-in is past its three days, even with the right token", async () => {
    vi.setSystemTime(new Date(NOW.getTime() + 3 * DAY + 60 * 1000));
    const res = await status(PUBLIC_ID, TOKEN);
    expect(res.status).toBe(404);
    expectHardened(res);
  });

  it("answers 404, not 500, when the database fails, and keeps the headers", async () => {
    m.prisma.walkInCheckIn.findUnique.mockRejectedValueOnce(new Error("connection reset"));
    const res = await status(PUBLIC_ID, TOKEN);
    expect(res.status).toBe(404);
    expectHardened(res);
    expect(JSON.stringify(res.body)).not.toContain("connection reset");
  });

  it("returns the tracker once confirmed, and the payload carries no mobile number, birth date, email or surname", async () => {
    rows.set(PUBLIC_ID, checkInRow({ status: "CONFIRMED", applicationId: 42, confirmedById: "ta-desk" }));
    const res = await status(PUBLIC_ID, TOKEN);
    expect(res.status).toBe(200);
    expectHardened(res);
    expect(res.body.data.tracking).toMatchObject({ trackingCode: "WLK-2026-0042", applicantName: "Juan D.", clientName: "Acme Logistics" });
    const json = JSON.stringify(res.body);
    expect(json).not.toMatch(/09171234567|\+639171234567|1990-05-09|Dela Cruz|Santos|juan@example\.com|mobileNumber|birthDate/);
  });
});

describe("POST /api/public/check-in", () => {
  it("creates a queue number, returns the status link with the view token, and echoes no contact details", async () => {
    const res = await request(app).post("/api/public/check-in").send(validBody());
    expect(res.status).toBe(201);
    expectHardened(res);
    expect(res.body.data).toEqual({
      publicId: NEW_ID,
      viewToken: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/),
      queueNumber: "A-001",
      statusPath: `/check-in/${NEW_ID}?token=${res.body.data.viewToken}`,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/09171234567|1990-05-09/);
    expect(m.prisma.application.create).not.toHaveBeenCalled();
  });

  const PDF = Buffer.from("%PDF-1.4\nbiodata\n%%EOF");
  const multipart = (file?: { buffer: Buffer; name: string; type: string }) => {
    const req = request(app).post("/api/public/check-in").set("x-turnstile-token", "test");
    for (const [key, value] of Object.entries(validBody())) req.field(key, String(value));
    if (file) req.attach("file", file.buffer, { filename: file.name, contentType: file.type });
    return req;
  };

  it("accepts a multipart submit with no file", async () => {
    const res = await multipart();
    expect(res.status).toBe(201);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("accepts a multipart submit with a PDF, holds it in private storage and saves its details", async () => {
    const res = await multipart({ buffer: PDF, name: "biodata.pdf", type: "application/pdf" });
    expect(res.status).toBe(201);
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(storage.upload.mock.calls[0][0]).toMatch(/^check-ins\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/);
    expect(m.prisma.walkInCheckIn.create.mock.calls[0][0].data).toMatchObject({
      biodataMimeType: "application/pdf",
      biodataFileName: "biodata.pdf",
      biodataSizeBytes: PDF.length,
    });
    expect(JSON.stringify(res.body)).not.toContain("check-ins/");
  });

  it.each([
    ["a Word file", { buffer: Buffer.from("PK\u0003\u0004 fake"), name: "cv.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }],
    ["a PDF label on other bytes", { buffer: Buffer.from("not really a pdf"), name: "x.pdf", type: "application/pdf" }],
  ])("answers 400 with the plain message for %s and creates nothing", async (_label, file) => {
    const res = await multipart(file);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Use a JPEG, PNG or WEBP photo, or a PDF, under 5 MB.");
    expect(m.prisma.walkInCheckIn.create).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("answers 400 for a file over 5 MB", async () => {
    const big = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(5 * 1024 * 1024), Buffer.from("\n%%EOF")]);
    const res = await multipart({ buffer: big, name: "big.pdf", type: "application/pdf" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Use a JPEG, PNG or WEBP photo, or a PDF, under 5 MB.");
    expect(m.prisma.walkInCheckIn.create).not.toHaveBeenCalled();
  });

  it("stores no file for an applicant who is already waiting", async () => {
    m.prisma.walkInCheckIn.findMany.mockResolvedValue([{ id: 1, publicId: PUBLIC_ID, queueSeq: 3, firstName: "Juan", lastName: "Dela Cruz" }]);
    const res = await multipart({ buffer: PDF, name: "biodata.pdf", type: "application/pdf" });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ alreadyCheckedIn: true, queueNumber: "A-003" });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("refuses a submission without a CAPTCHA token before any database work (production rules)", async () => {
    const previous = { env: process.env.NODE_ENV, disable: process.env.DISABLE_CAPTCHA };
    process.env.NODE_ENV = "production";
    delete process.env.DISABLE_CAPTCHA;
    try {
      const res = await request(app).post("/api/public/check-in").send(validBody());
      expect(res.status).toBe(403);
    } finally {
      process.env.NODE_ENV = previous.env;
      if (previous.disable === undefined) delete process.env.DISABLE_CAPTCHA;
      else process.env.DISABLE_CAPTCHA = previous.disable;
    }
    expect(m.prisma.jobPosting.findUnique).not.toHaveBeenCalled();
    expect(m.prisma.walkInCheckIn.create).not.toHaveBeenCalled();
  });

  it.each([
    ["17 years old", { birthDate: birthdayFor(18, 1) }, "between 18 and 65"],
    ["66 years old", { birthDate: birthdayFor(66) }, "between 18 and 65"],
    ["a missing birth date", { birthDate: undefined }, undefined],
  ])("answers 400 with field errors for %s, and creates nothing", async (_label, over, expected) => {
    const res = await request(app).post("/api/public/check-in").send(validBody(over));
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    if (expected) expect(JSON.stringify(res.body.error)).toContain(expected);
    expect(m.prisma.walkInCheckIn.create).not.toHaveBeenCalled();
  });

  it("refuses fields a caller should not be able to set, such as a status or an application id", async () => {
    const res = await request(app).post("/api/public/check-in").send(validBody({ status: "CONFIRMED", applicationId: 42 }));
    expect(res.status).toBe(400);
    expect(m.prisma.walkInCheckIn.create).not.toHaveBeenCalled();
  });

  it("answers 400 with the readable message for a job that has closed", async () => {
    const res = await request(app).post("/api/public/check-in").send(validBody({ jobPostingId: 6 }));
    expect(res.status).toBe(400);
    expectHardened(res);
    expect(res.body.message).toBe("This job is no longer accepting applications");
    expect(m.prisma.walkInCheckIn.create).not.toHaveBeenCalled();
  });

  it("answers 500 with a generic message, and no internal text, for an unexpected failure", async () => {
    m.prisma.jobPosting.findUnique.mockRejectedValueOnce(new Error("connection reset by peer"));
    const res = await request(app).post("/api/public/check-in").send(validBody());
    expect(res.status).toBe(500);
    expectHardened(res);
    expect(JSON.stringify(res.body)).not.toContain("connection reset");
  });

  it.each([
    ["an HTML page named .png", { buffer: Buffer.from("<html><script>alert(1)</script></html>"), name: "photo.png", type: "image/png" }],
    ["a Windows program named .jpg", { buffer: Buffer.from("MZ\x90\x00 program"), name: "photo.jpg", type: "image/jpeg" }],
    ["a PDF sent as a JPEG", { buffer: PDF, name: "scan.jpg", type: "image/jpeg" }],
    ["an HTML page named .pdf", { buffer: Buffer.from("<html><script>alert(1)</script></html>"), name: "biodata.pdf", type: "application/pdf" }],
  ])("rejects %s by its bytes, not its name, and stores nothing", async (_label, file) => {
    const res = await multipart(file);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Use a JPEG, PNG or WEBP photo, or a PDF, under 5 MB.");
    expect(storage.upload).not.toHaveBeenCalled();
    expect(m.prisma.walkInCheckIn.create).not.toHaveBeenCalled();
  });

  it("checks the CAPTCHA before multer reads the file: a disallowed upload with no token is a 403, not a 400", async () => {
    const previous = { env: process.env.NODE_ENV, disable: process.env.DISABLE_CAPTCHA };
    process.env.NODE_ENV = "production";
    delete process.env.DISABLE_CAPTCHA;
    try {
      const req = request(app).post("/api/public/check-in");
      for (const [key, value] of Object.entries(validBody())) req.field(key, String(value));
      const res = await req.attach("file", Buffer.from("MZ program"), { filename: "run.exe", contentType: "application/x-msdownload" });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/CAPTCHA/);
    } finally {
      process.env.NODE_ENV = previous.env;
      if (previous.disable === undefined) delete process.env.DISABLE_CAPTCHA;
      else process.env.DISABLE_CAPTCHA = previous.disable;
    }
    expect(storage.upload).not.toHaveBeenCalled();
    expect(m.prisma.jobPosting.findUnique).not.toHaveBeenCalled();
  });

  it("builds the storage path from the server's id only: a hostile file name never reaches the folder", async () => {
    const res = await multipart({ buffer: PDF, name: "../../../etc/evil.pdf", type: "application/pdf" });
    expect(res.status).toBe(201);
    const path = storage.upload.mock.calls[0][0] as string;
    expect(path).toMatch(/^check-ins\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/);
    expect(path).not.toContain("..");
    const data = m.prisma.walkInCheckIn.create.mock.calls[0][0].data;
    expect(path.split("/")[1]).toBe(data.publicId);
    expect(data).toMatchObject({ biodataStoragePath: path, biodataFileName: "evil.pdf" });
  });

  it.each([
    ["publicId", "11111111-2222-4333-8444-555555555555"],
    ["biodataStoragePath", "check-ins/someone-else/held.pdf"],
  ])("refuses a client-supplied %s field, and stores nothing", async (field, value) => {
    const req = request(app).post("/api/public/check-in").set("x-turnstile-token", "test");
    for (const [key, v] of Object.entries(validBody())) req.field(key, String(v));
    const res = await req.field(field, value).attach("file", PDF, { filename: "biodata.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(400);
    expect(storage.upload).not.toHaveBeenCalled();
    expect(m.prisma.walkInCheckIn.create).not.toHaveBeenCalled();
  });
});
