import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";

// No-login pages reached from a printed QR slip or a texted link. Every failure must be the same 404,
// with no-store and no-referrer headers. The database and every side-effecting dependency are mocked.
const m = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    prisma: {
      application: { findUnique: fn(), create: fn() },
      talentPoolInvitation: { findUnique: fn(), update: fn(), updateMany: fn() },
      jobPosting: { count: fn() },
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
vi.mock("../../src/utils/supabase.js", () => ({ default: { auth: { admin: {} } } }));
vi.mock("../../src/middleware/upload.middleware.js", () => ({ uploadFileToSupabase: vi.fn() }));
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

import { getPublicTrackingHandler } from "../../src/controllers/public/public-track.controller.js";
import { getPublicOfferHandler, respondPublicOfferHandler } from "../../src/controllers/public/public-offer.controller.js";

const CODE = "WLK-2026-0042";
const TRACK_TOKEN = "Zr3k9x_Lp0QaVbNw2hYt7g";
const OFFER_TOKEN = "Lq8vR2mZ_tK4wXnP0aBcDe";
const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

type FakeRes = {
  statusCode: number;
  body: any;
  headers: Record<string, string>;
  status(code: number): FakeRes;
  json(body: unknown): FakeRes;
  set(values: Record<string, string>): FakeRes;
  setHeader(name: string, value: string): FakeRes;
};

// Records what Express would send: status, JSON body and response headers (names lower-cased).
const makeRes = (): FakeRes => {
  const res: FakeRes = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
    set(values) {
      for (const [name, value] of Object.entries(values)) res.headers[name.toLowerCase()] = value;
      return res;
    },
    setHeader(name, value) {
      res.headers[name.toLowerCase()] = value;
      return res;
    },
  };
  return res;
};

const expectHardened = (res: FakeRes) => {
  expect(res.headers["cache-control"]).toBe("no-store");
  expect(res.headers["referrer-policy"]).toBe("no-referrer");
};

const trackRow = () => ({
  trackingCode: CODE,
  trackingTokenHash: sha256(TRACK_TOKEN),
  status: "SUBMITTED",
  createdAt: new Date("2026-10-22T01:00:00Z"),
  updatedAt: new Date("2026-10-22T03:00:00Z"),
  user: {
    applicantProfile: { firstName: "Juan", lastName: "Dela Cruz", mobileNumber: "09171234567", email: "juan@example.com" },
  },
  jobPosting: { title: "Forklift Operator", location: "Cebu City", mrf: { client: { name: "Acme Logistics" } } },
  interviews: [],
});

// One offer invitation and its applications, behaving like the database for these calls.
let inv: any;
let applications: any[];

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.APP_URL;
  delete process.env.FRONTEND_URL;

  m.prisma.application.findUnique.mockImplementation(async ({ where }: any) =>
    where.trackingCode === CODE ? trackRow() : null
  );

  inv = {
    id: 9,
    applicantProfileId: 3,
    membershipId: null,
    jobPostingId: 5,
    invitedById: "ta-1",
    status: "PENDING",
    message: "Report Monday",
    declineReason: null,
    responseNotes: null,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    respondedAt: null,
    responseChannel: "PORTAL",
    assistedById: null,
    responseTokenHash: sha256(OFFER_TOKEN),
    applicantProfile: {
      id: 3,
      userId: "user-1",
      firstName: "Juan",
      lastName: "Dela Cruz",
      resumeUrl: null,
      mobileNumber: "09171234567",
      user: { phoneNumber: "+639171234567" },
    },
    jobPosting: {
      id: 5,
      title: "Forklift Operator",
      location: "Cebu City",
      status: "OPEN",
      mrf: { clientId: 2, client: { name: "Acme Logistics" } },
    },
  };
  applications = [];

  m.prisma.talentPoolInvitation.findUnique.mockImplementation(async ({ where }: any) =>
    inv && inv.id === where.id ? structuredClone(inv) : null
  );
  m.prisma.talentPoolInvitation.update.mockImplementation(async ({ where, data }: any) => {
    if (!inv || inv.id !== where.id) throw new Error("Record to update not found.");
    Object.assign(inv, data);
    return structuredClone(inv);
  });
  m.prisma.$transaction.mockImplementation(async (fn: any) => fn(m.prisma));
  // Conditional claim, as the service does it: only a row that is still PENDING can be changed.
  m.prisma.talentPoolInvitation.updateMany.mockImplementation(async ({ where, data }: any) => {
    const matches = !!inv && inv.id === where.id && (where.status === undefined || inv.status === where.status);
    if (!matches) return { count: 0 };
    Object.assign(inv, data);
    return { count: 1 };
  });
  m.prisma.jobPosting.count.mockResolvedValue(1);
  m.prisma.deployment.findFirst.mockResolvedValue(null);
  m.prisma.deployment.findMany.mockResolvedValue([]);
  m.prisma.application.create.mockImplementation(async ({ data }: any) => {
    const row = { id: 100 + applications.length, ...data };
    applications.push(row);
    return structuredClone(row);
  });
  m.prisma.recruiterDecision.create.mockResolvedValue({});
  m.prisma.talentPoolContact.create.mockResolvedValue({});
  m.prisma.talentPoolMembership.update.mockResolvedValue({});
  m.logAudit.mockResolvedValue(undefined);
  m.sendNotification.mockResolvedValue(undefined);
  m.calculateAndPersistCandidateScore.mockResolvedValue(undefined);
});

describe("GET /api/public/track/:code", () => {
  const track = async (query: Record<string, unknown>, code = CODE) => {
    const res = makeRes();
    await getPublicTrackingHandler({ params: { code }, query } as any, res as any);
    return res;
  };

  it("answers 200 with the public tracker fields and no contact details", async () => {
    const res = await track({ token: TRACK_TOKEN });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Object.keys(res.body.data).sort()).toEqual([
      "applicantName",
      "appliedAt",
      "clientName",
      "jobTitle",
      "nextInterview",
      "status",
      "trackingCode",
      "updatedAt",
      "venue",
    ]);
    expect(res.body.data.applicantName).toBe("Juan D.");
    const json = JSON.stringify(res.body);
    expect(json).not.toContain("09171234567");
    expect(json).not.toContain("juan@example.com");
    expect(json).not.toContain("Dela Cruz");
    expectHardened(res);
  });

  it("answers 404 for a wrong token, with no-store and no-referrer", async () => {
    const res = await track({ token: "Wrong_token_value_1" });
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body).not.toHaveProperty("data");
    expectHardened(res);
  });

  it("answers the same 404 for an unknown code as for a wrong token, so the link reveals nothing", async () => {
    const wrongToken = await track({ token: "Wrong_token_value_1" });
    const unknownCode = await track({ token: TRACK_TOKEN }, "WLK-2026-9999");
    expect(unknownCode.statusCode).toBe(404);
    expect(unknownCode.body).toEqual(wrongToken.body);
    expectHardened(unknownCode);
  });

  it.each([
    ["no token", {}],
    ["a repeated token", { token: [TRACK_TOKEN, TRACK_TOKEN] }],
    ["an oversized token", { token: "t".repeat(101) }],
  ])("answers 404 for %s without asking the database", async (_label, query) => {
    const res = await track(query as any);
    expect(res.statusCode).toBe(404);
    expectHardened(res);
    expect(m.prisma.application.findUnique).not.toHaveBeenCalled();
  });

  it("answers 404, not 500, when the database fails, and keeps the headers", async () => {
    m.prisma.application.findUnique.mockRejectedValueOnce(new Error("connection reset"));
    const res = await track({ token: TRACK_TOKEN });
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expectHardened(res);
  });
});

describe("GET /api/public/offers/:id", () => {
  const offer = async (id: string, query: Record<string, unknown>) => {
    const res = makeRes();
    await getPublicOfferHandler({ params: { id }, query } as any, res as any);
    return res;
  };

  it("answers 200 with the offer and no contact details", async () => {
    const res = await offer("9", { token: OFFER_TOKEN });
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual([
      "applicantFirstName",
      "clientName",
      "expiresAt",
      "invitationId",
      "jobTitle",
      "location",
      "message",
      "status",
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(/09171234567|juan@example\.com|Dela Cruz/);
    expectHardened(res);
  });

  it("answers 404 for a wrong token, with no-store and no-referrer", async () => {
    const res = await offer("9", { token: "Wrong_token_value_1" });
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expectHardened(res);
  });

  it("answers the same 404 for an unknown invitation as for a wrong token", async () => {
    const wrongToken = await offer("9", { token: "Wrong_token_value_1" });
    const unknownId = await offer("99", { token: OFFER_TOKEN });
    expect(unknownId.body).toEqual(wrongToken.body);
    expect(unknownId.statusCode).toBe(404);
  });

  it.each([
    ["a non-numeric id", "abc", { token: OFFER_TOKEN }],
    ["a token shorter than the minimum", "9", { token: "abc" }],
    ["a token with characters outside the allowed set", "9", { token: "abc$%^def123" }],
    ["a repeated token", "9", { token: [OFFER_TOKEN, OFFER_TOKEN] }],
  ])("answers 404 for %s", async (_label, id, query) => {
    const res = await offer(id, query as any);
    expect(res.statusCode).toBe(404);
    expectHardened(res);
    expect(m.prisma.talentPoolInvitation.findUnique).not.toHaveBeenCalled();
  });
});

describe("POST /api/public/offers/:id/respond", () => {
  const respond = async (id: string, body: Record<string, unknown>) => {
    const res = makeRes();
    await respondPublicOfferHandler({ params: { id }, body } as any, res as any);
    return res;
  };

  it("answers 404 for a wrong token and changes nothing", async () => {
    const res = await respond("9", { token: "Wrong_token_value_1", decision: "ACCEPT" });
    expect(res.statusCode).toBe(404);
    expectHardened(res);
    expect(inv.status).toBe("PENDING");
    expect(applications).toHaveLength(0);
  });

  it("refuses extra fields in the body, so a caller cannot set the status directly", async () => {
    const res = await respond("9", { token: OFFER_TOKEN, decision: "ACCEPT", status: "ACCEPTED" });
    expect(res.statusCode).toBe(404);
    expect(inv.status).toBe("PENDING");
    expect(applications).toHaveLength(0);
  });

  it("refuses a decision other than ACCEPT or DECLINE", async () => {
    const res = await respond("9", { token: OFFER_TOKEN, decision: "MAYBE" });
    expect(res.statusCode).toBe(404);
    expect(inv.status).toBe("PENDING");
  });

  it("accepts once with the right token, with no-store headers", async () => {
    const res = await respond("9", { token: OFFER_TOKEN, decision: "ACCEPT" });
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual({ status: "ACCEPTED", applicationId: 100 });
    expect(inv.responseTokenHash).toBeNull();
    expectHardened(res);
  });

  it("lets only one of two simultaneous taps on the same link through", async () => {
    const [a, b] = await Promise.all([
      respond("9", { token: OFFER_TOKEN, decision: "ACCEPT" }),
      respond("9", { token: OFFER_TOKEN, decision: "ACCEPT" }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 404]);
    expect(applications).toHaveLength(1);
  });

  it("answers 404 when the same link is used a second time, and creates no second application", async () => {
    const first = await respond("9", { token: OFFER_TOKEN, decision: "ACCEPT" });
    expect(first.statusCode).toBe(200);

    const second = await respond("9", { token: OFFER_TOKEN, decision: "DECLINE", declineReason: "NOT_INTERESTED" });
    expect(second.statusCode).toBe(404);
    expect(second.body.success).toBe(false);
    expectHardened(second);
    expect(applications).toHaveLength(1);
  });
});
