import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";

// Every database, auth, storage and queue call is mocked. Nothing here reaches the hosted database.
const m = vi.hoisted(() => {
  const fn = () => vi.fn();
  const prisma: Record<string, any> = {
    user: { findMany: fn(), findUnique: fn(), findFirst: fn(), create: fn(), update: fn(), deleteMany: fn() },
    applicantProfile: { findUnique: fn(), create: fn(), update: fn(), updateMany: fn(), deleteMany: fn() },
    storedDocument: { deleteMany: fn() },
    jobPosting: { findUnique: fn(), findMany: fn(), updateMany: fn() },
    application: { create: fn(), update: fn(), findUnique: fn() },
    manpowerRequest: { findUnique: fn(), update: fn() },
    $transaction: fn(),
  };
  return {
    prisma,
    supabase: { auth: { admin: { createUser: fn(), deleteUser: fn() } } },
    uploadFileToSupabase: fn(),
    logAudit: fn(),
    enqueueResumeAnalysis: fn(),
    trackFitRevalidation: fn(),
    revalidateApplication: fn(),
    assertCanApply: fn(),
    resolveInitialStatus: fn(),
    assertOwns: fn(),
    generateComplianceRequirementsFromMRF: fn(),
    reuseValidSameClientDocuments: fn(),
    sendNotification: fn(),
    sendRoleNotification: fn(),
    parseResumeToProposal: fn(),
    fillBlanksFromParse: fn(),
  };
});

vi.mock("../utils/prisma.js", () => ({ default: m.prisma }));
vi.mock("../utils/supabase.js", () => ({ default: m.supabase }));
vi.mock("../middleware/upload.middleware.js", () => ({ uploadFileToSupabase: m.uploadFileToSupabase }));
vi.mock("../utils/audit.js", () => ({ logAudit: m.logAudit }));
vi.mock("../utils/notification.js", () => ({ sendNotification: m.sendNotification, sendRoleNotification: m.sendRoleNotification }));
vi.mock("../workers/resume.worker.js", () => ({ enqueueResumeAnalysis: m.enqueueResumeAnalysis, trackFitRevalidation: m.trackFitRevalidation }));
vi.mock("../services/scoring/scoring-configuration.service.js", () => ({ revalidateApplication: m.revalidateApplication }));
vi.mock("../services/applicant/application.service.js", () => ({ assertCanApply: m.assertCanApply, resolveInitialStatus: m.resolveInitialStatus }));
vi.mock("../services/ta/ta.compliance.service.js", () => ({
  generateComplianceRequirementsFromMRF: m.generateComplianceRequirementsFromMRF,
  reuseValidSameClientDocuments: m.reuseValidSameClientDocuments,
}));
vi.mock("../services/applicant/resume-merge.service.js", () => ({
  parseResumeToProposal: m.parseResumeToProposal,
  fillBlanksFromParse: m.fillBlanksFromParse,
}));
// Keep the real ownership rules for everything except the job check, which each test controls.
vi.mock("../services/ta/ownership.js", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  assertOwns: m.assertOwns,
}));

import {
  WalkInConflictError,
  buildSyntheticWalkInEmail,
  buildTrackingCode,
  createWalkIn,
  findWalkInDuplicates,
  generateTrackingToken,
  getPublicTracking,
  hashToken,
  normalizeName,
  reissueSlip,
  tokenMatches,
  type CreateWalkInInput,
} from "../services/ta/walk-in.service.js";
import { calculateMRFFulfillment, syncMRFFulfillmentStatus } from "../services/ta/ta.mrf.service.js";
import { isSyntheticEmail } from "../utils/sms.js";

const TA = { id: "ta-1", role: "TALENT_ACQUISITION" };
const USER_ID = "11111111-1111-4111-8111-111111111111";
const TOKEN = "Zr3k9x_Lp0QaVbNw2hYt7g";
const FILE = {
  buffer: Buffer.from("%PDF-1.4 biodata"),
  mimetype: "application/pdf",
  originalname: "biodata.pdf",
  size: 16,
} as unknown as Express.Multer.File;

const applicationRow = (over: Record<string, unknown> = {}) => ({
  id: 42,
  source: "WALK_IN",
  trackingCode: "WLK-2026-0042",
  trackingTokenHash: null as string | null,
  status: "SUBMITTED",
  createdAt: new Date("2026-10-22T01:00:00Z"),
  updatedAt: new Date("2026-10-22T03:00:00Z"),
  jobPosting: { title: "Forklift Operator", location: "Cebu City", mrf: { client: { name: "Acme Logistics" } } },
  user: {
    applicantProfile: { firstName: "Juan", middleName: "Santos", lastName: "Dela Cruz", mobileNumber: "09171234567" },
  },
  interviews: [] as Array<{ type: string; scheduledAt: Date }>,
  ...over,
});

const baseInput = (over: Partial<CreateWalkInInput> = {}): CreateWalkInInput => ({
  jobPostingId: 5,
  source: "WALK_IN",
  firstName: "Juan",
  middleName: "Santos",
  lastName: "Dela Cruz",
  mobileNumber: "0917 123 4567",
  birthDate: "1990-05-09",
  existingUserId: null,
  ...over,
});

const resetMocks = () => {
  vi.resetAllMocks();
  m.prisma.$transaction.mockImplementation(async (fn: any) => fn(m.prisma));
  m.supabase.auth.admin.createUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  m.supabase.auth.admin.deleteUser.mockResolvedValue({ data: null, error: null });
  m.assertOwns.mockResolvedValue(undefined);
  m.assertCanApply.mockResolvedValue({ id: 5, status: "OPEN", mrf: { clientId: 3 } });
  m.resolveInitialStatus.mockResolvedValue({
    status: "SUBMITTED",
    attemptNumber: 1,
    sameClientDeployment: false,
    sameClientDeployments: [],
  });
  m.uploadFileToSupabase.mockResolvedValue("https://storage.example/applicant-assets/resume.pdf");
  m.enqueueResumeAnalysis.mockResolvedValue(undefined);
  m.revalidateApplication.mockResolvedValue(undefined);
  m.generateComplianceRequirementsFromMRF.mockResolvedValue(undefined);
  m.reuseValidSameClientDocuments.mockResolvedValue(undefined);
  m.prisma.jobPosting.findUnique.mockResolvedValue({ id: 5, status: "OPEN" });
  m.prisma.user.findFirst.mockResolvedValue(null);
  m.prisma.user.findUnique.mockResolvedValue(null);
  m.prisma.user.create.mockResolvedValue({ id: USER_ID });
  m.prisma.user.update.mockResolvedValue({});
  m.prisma.user.deleteMany.mockResolvedValue({ count: 1 });
  m.prisma.applicantProfile.findUnique.mockResolvedValue({ id: 9 });
  m.parseResumeToProposal.mockResolvedValue({ id: 77 });
  m.fillBlanksFromParse.mockResolvedValue({});
  m.prisma.applicantProfile.create.mockResolvedValue({});
  m.prisma.applicantProfile.update.mockResolvedValue({});
  m.prisma.applicantProfile.updateMany.mockResolvedValue({ count: 1 });
  m.prisma.applicantProfile.deleteMany.mockResolvedValue({ count: 1 });
  m.prisma.storedDocument.deleteMany.mockResolvedValue({ count: 1 });
  m.prisma.application.create.mockResolvedValue({ id: 42, userId: USER_ID });
  m.prisma.application.update.mockImplementation(async ({ data }: any) =>
    applicationRow({ trackingCode: data.trackingCode, trackingTokenHash: data.trackingTokenHash })
  );
};

beforeEach(() => {
  resetMocks();
  // Pin the clock so the tracking code year is deterministic.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-22T02:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("tracking codes", () => {
  it("formats the code as WLK-<year>-<id padded to four digits>", () => {
    expect(buildTrackingCode("WALK_IN", 42, 2026)).toBe("WLK-2026-0042");
    expect(buildTrackingCode("WALK_IN", 7, 2027)).toBe("WLK-2027-0007");
  });

  it("does not truncate ids wider than four digits", () => {
    expect(buildTrackingCode("WALK_IN", 12345, 2026)).toBe("WLK-2026-12345");
  });

  it("hashes tokens with sha256 hex", () => {
    // Known SHA-256 vector for "abc"
    expect(hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("generates a 16-byte base64url token whose stored hash is the sha256 of that token", () => {
    const { token, hash } = generateTrackingToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(crypto.createHash("sha256").update(token).digest("hex"));
  });

  it("never repeats a token across many calls", () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generateTrackingToken().token));
    expect(tokens.size).toBe(500);
  });
});

describe("tokenMatches", () => {
  it("accepts the token that produced the stored hash", () => {
    expect(tokenMatches(TOKEN, hashToken(TOKEN))).toBe(true);
  });

  it("rejects a different token", () => {
    expect(tokenMatches("Some_other_token_1234", hashToken(TOKEN))).toBe(false);
  });

  it("rejects when no hash is stored (online applications and cleared links)", () => {
    expect(tokenMatches(TOKEN, null)).toBe(false);
    expect(tokenMatches(TOKEN, undefined)).toBe(false);
    expect(tokenMatches(TOKEN, "")).toBe(false);
  });

  it("rejects an empty token even against a matching empty-string hash", () => {
    expect(tokenMatches("", hashToken(""))).toBe(false);
  });

  it("rejects a stored hash of the wrong length without throwing", () => {
    expect(() => tokenMatches(TOKEN, "abcd")).not.toThrow();
    expect(tokenMatches(TOKEN, "abcd")).toBe(false);
  });

  it("rejects a stored value that is not hex", () => {
    expect(tokenMatches(TOKEN, "z".repeat(64))).toBe(false);
  });
});

describe("synthetic walk-in emails", () => {
  it("uses the phone-derived address for a walk-in with a mobile number", () => {
    expect(buildSyntheticWalkInEmail("+639171234567")).toBe("639171234567@applicant.megs.local");
    expect(buildSyntheticWalkInEmail("0917 123 4567")).toBe("639171234567@applicant.megs.local");
  });

  it("uses a random megs.internal address when there is no phone, and never repeats it", () => {
    const first = buildSyntheticWalkInEmail(null);
    const second = buildSyntheticWalkInEmail(null);
    expect(first).toMatch(/^walkin_[0-9a-f-]{36}@megs\.internal$/);
    expect(first).not.toBe(second);
  });

  it("marks both forms as synthetic", () => {
    expect(isSyntheticEmail(buildSyntheticWalkInEmail("09171234567"))).toBe(true);
    expect(isSyntheticEmail(buildSyntheticWalkInEmail(null))).toBe(true);
  });
});

describe("normalizeName", () => {
  it("lowercases, removes accents and collapses extra spaces", () => {
    expect(normalizeName("  JOSÉ   Peña \t Dela  Cruz ")).toBe("jose pena dela cruz");
  });

  it("folds Ñ to n", () => {
    expect(normalizeName("Ñoño")).toBe("nono");
  });

  it("returns an empty string for missing names", () => {
    expect(normalizeName(null)).toBe("");
    expect(normalizeName(undefined)).toBe("");
  });
});

describe("findWalkInDuplicates", () => {
  const dbRow = (over: Record<string, unknown> = {}) => ({
    id: "u-1",
    phoneNumber: null as string | null,
    accountStatus: "WALK_IN",
    createdAt: new Date("2026-10-01T00:00:00Z"),
    applicantProfile: {
      firstName: "Juan",
      middleName: "Santos",
      lastName: "Dela Cruz",
      mobileNumber: null as string | null,
      dateOfBirth: new Date("1990-05-09T00:00:00+08:00"),
    },
    applications: [{ status: "SUBMITTED", jobPosting: { title: "Forklift Operator" } }],
    ...over,
  });

  it("searches nothing and returns no matches when there is no usable phone or full name", async () => {
    expect(await findWalkInDuplicates({ phone: "12345" })).toEqual({ matches: [] });
    expect(await findWalkInDuplicates({ firstName: "Juan" })).toEqual({ matches: [] });
    expect(m.prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("searches applicants only, and every spelling of the phone number", async () => {
    m.prisma.user.findMany.mockResolvedValueOnce([]);
    await findWalkInDuplicates({ phone: "0917 123 4567" });
    const args = m.prisma.user.findMany.mock.calls[0][0];
    expect(args.where.role).toBe("APPLICANT");
    expect(args.where.OR).toEqual(
      expect.arrayContaining([{ phoneNumber: { in: ["+639171234567", "09171234567", "639171234567"] } }])
    );
  });

  it("returns a phone match with a masked number, portal and walk-in flags, and latest application", async () => {
    m.prisma.user.findMany.mockResolvedValueOnce([dbRow({ phoneNumber: "+639171234567" })]);
    const { matches } = await findWalkInDuplicates({ phone: "0917 123 4567" });
    expect(matches).toHaveLength(1);
    const [match] = matches;
    expect(match).toMatchObject({
      userId: "u-1",
      fullName: "Juan Santos Dela Cruz",
      hasPortalAccess: false,
      isWalkIn: true,
      latestApplication: { jobTitle: "Forklift Operator", status: "SUBMITTED" },
    });
    // The middle digits stay hidden. How many trailing digits show is a maskPhoneNumber detail, not checked here.
    expect(match.maskedPhone).toMatch(/^0917\*{4}\d+$/);
    expect(match.maskedPhone).not.toContain("1234");
  });

  it("reports portal access for an ACTIVE account", async () => {
    m.prisma.user.findMany.mockResolvedValueOnce([dbRow({ accountStatus: "ACTIVE", phoneNumber: "+639171234567" })]);
    const { matches } = await findWalkInDuplicates({ phone: "09171234567" });
    expect(matches[0]).toMatchObject({ hasPortalAccess: true, isWalkIn: false });
  });

  it("matches a name, ignoring case, accents and spacing", async () => {
    m.prisma.user.findMany.mockResolvedValueOnce([dbRow()]);
    const { matches } = await findWalkInDuplicates({ firstName: " JUAN ", lastName: "dela   cruz" });
    expect(matches).toHaveLength(1);
  });

  it("matches an accented name against a plain query", async () => {
    m.prisma.user.findMany.mockResolvedValueOnce([
      dbRow({ applicantProfile: { firstName: "José", lastName: "Peña", middleName: null, mobileNumber: null, dateOfBirth: null } }),
    ]);
    const { matches } = await findWalkInDuplicates({ firstName: "JOSE", lastName: "pena" });
    expect(matches).toHaveLength(1);
  });

  it("drops a name-only match when the birth date differs", async () => {
    m.prisma.user.findMany.mockResolvedValueOnce([
      dbRow({ applicantProfile: { firstName: "Juan", lastName: "Dela Cruz", middleName: null, mobileNumber: null, dateOfBirth: new Date("1985-01-01T00:00:00+08:00") } }),
    ]);
    const { matches } = await findWalkInDuplicates({ firstName: "Juan", lastName: "Dela Cruz", birthDate: "1990-05-09" });
    expect(matches).toEqual([]);
  });

  it("keeps a name match when the birth date also matches", async () => {
    m.prisma.user.findMany.mockResolvedValueOnce([dbRow()]);
    const { matches } = await findWalkInDuplicates({ firstName: "Juan", lastName: "Dela Cruz", birthDate: "1990-05-09" });
    expect(matches).toHaveLength(1);
  });

  it("keeps a name-only match when no birth date was given", async () => {
    m.prisma.user.findMany.mockResolvedValueOnce([dbRow({ applicantProfile: { firstName: "Juan", lastName: "Dela Cruz", middleName: null, mobileNumber: null, dateOfBirth: null } })]);
    const { matches } = await findWalkInDuplicates({ firstName: "Juan", lastName: "Dela Cruz" });
    expect(matches).toHaveLength(1);
  });

  it("drops rows that match neither the phone nor the name", async () => {
    m.prisma.user.findMany.mockResolvedValueOnce([
      dbRow({ phoneNumber: "+639998887777", applicantProfile: { firstName: "Pedro", lastName: "Santos", middleName: null, mobileNumber: null, dateOfBirth: null } }),
    ]);
    const { matches } = await findWalkInDuplicates({ phone: "0917 123 4567", firstName: "Juan", lastName: "Dela Cruz" });
    expect(matches).toEqual([]);
  });

  it("returns at most five matches", async () => {
    m.prisma.user.findMany.mockResolvedValueOnce(
      Array.from({ length: 7 }, (_, i) => dbRow({ id: `u-${i}`, phoneNumber: "+639171234567" }))
    );
    const { matches } = await findWalkInDuplicates({ phone: "09171234567" });
    expect(matches).toHaveLength(5);
  });
});

describe("createWalkIn: new person", () => {
  it("creates the synthetic login, a WALK_IN user, the application and a hashed-token slip", async () => {
    const slip = await createWalkIn(TA, baseInput(), FILE);

    const createArgs = m.supabase.auth.admin.createUser.mock.calls[0][0];
    expect(createArgs.email).toBe("639171234567@applicant.megs.local");
    expect(createArgs.email_confirm).toBe(true);
    expect(createArgs.password.length).toBeGreaterThanOrEqual(32);

    expect(m.prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: USER_ID,
        email: "639171234567@applicant.megs.local",
        role: "APPLICANT",
        accountStatus: "WALK_IN",
        invitedBy: "ta-1",
        phoneNumber: "+639171234567",
      }),
    });

    expect(m.prisma.application.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: USER_ID, jobPostingId: 5, source: "WALK_IN", status: "SUBMITTED" }),
    });

    expect(slip.applicationId).toBe(42);
    expect(slip.trackingCode).toBe("WLK-2026-0042");
    expect(slip.trackingToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(slip.trackPath).toBe(`/t/WLK-2026-0042?token=${slip.trackingToken}`);
    expect(slip.applicantName).toBe("Juan Santos Dela Cruz");
    expect(slip.jobTitle).toBe("Forklift Operator");
    expect(slip.clientName).toBe("Acme Logistics");
    expect(slip.location).toBe("Cebu City");
  });

  it("stores only the hash of the tracking token, never the raw token", async () => {
    const slip = await createWalkIn(TA, baseInput(), FILE);
    const writeData = m.prisma.application.update.mock.calls[0][0].data;
    expect(writeData.trackingTokenHash).toBe(hashToken(slip.trackingToken));
    expect(writeData.trackingCode).toBe("WLK-2026-0042");
    expect(JSON.stringify(writeData)).not.toContain(slip.trackingToken);
  });

  it("queues resume analysis and leaves the auth user alone on success", async () => {
    await createWalkIn(TA, baseInput(), FILE);
    expect(m.enqueueResumeAnalysis).toHaveBeenCalledWith(42);
    expect(m.supabase.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("gives a walk-in without a phone a megs.internal placeholder, with no phone and no taken-number check", async () => {
    await createWalkIn(TA, baseInput({ mobileNumber: null }), FILE);
    const { email } = m.supabase.auth.admin.createUser.mock.calls[0][0];
    expect(email).toMatch(/^walkin_[0-9a-f-]{36}@megs\.internal$/);
    expect(isSyntheticEmail(email)).toBe(true);
    expect(m.prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ accountStatus: "WALK_IN", phoneNumber: null }),
    });
    expect(m.prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it("starts at COMPLIANCE and generates requirements when the applicant was placed with this client before", async () => {
    m.resolveInitialStatus.mockResolvedValueOnce({
      status: "COMPLIANCE",
      attemptNumber: 2,
      sameClientDeployment: true,
      sameClientDeployments: [{ id: 9, applicationId: 17 }],
    });
    await createWalkIn(TA, baseInput(), FILE);
    expect(m.prisma.application.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "COMPLIANCE", attemptNumber: 2 }) });
    expect(m.generateComplianceRequirementsFromMRF).toHaveBeenCalledWith(42);
    expect(m.reuseValidSameClientDocuments).toHaveBeenCalledWith(42, [17]);
    expect(m.enqueueResumeAnalysis).not.toHaveBeenCalled();
  });

  it("logs the encoding with the source and that no existing user was reused", async () => {
    await createWalkIn(TA, baseInput(), FILE);
    expect(m.logAudit).toHaveBeenCalledWith("ta-1", "WALK_IN_ENCODED", "Application", 42, {
      source: "WALK_IN",
      reusedExistingUser: false,
    });
  });

  it("stops before any write when Supabase refuses to create the auth user", async () => {
    m.supabase.auth.admin.createUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "email already registered" } });
    await expect(createWalkIn(TA, baseInput(), FILE)).rejects.toThrow("email already registered");
    expect(m.prisma.user.create).not.toHaveBeenCalled();
    expect(m.supabase.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("deletes the auth user when the User row cannot be written", async () => {
    m.prisma.user.create.mockRejectedValueOnce(new Error("unique constraint failed"));
    await expect(createWalkIn(TA, baseInput(), FILE)).rejects.toThrow("unique constraint failed");
    expect(m.supabase.auth.admin.deleteUser).toHaveBeenCalledWith(USER_ID);
    expect(m.prisma.application.create).not.toHaveBeenCalled();
  });

  it("removes the auth user and the User row when only the profile write fails", async () => {
    m.prisma.applicantProfile.create.mockRejectedValueOnce(new Error("profile write failed"));
    await expect(createWalkIn(TA, baseInput(), FILE)).rejects.toThrow("profile write failed");
    expect(m.supabase.auth.admin.deleteUser).toHaveBeenCalledWith(USER_ID);
    // User and profile are written in one transaction, so a failed profile write leaves no WALK_IN row behind.
    expect(m.prisma.$transaction).toHaveBeenCalled();
    expect(m.prisma.application.create).not.toHaveBeenCalled();
  });

  it("rolls back the new applicant when the resume upload fails", async () => {
    m.uploadFileToSupabase.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(createWalkIn(TA, baseInput(), FILE)).rejects.toThrow("storage unavailable");
    expect(m.prisma.storedDocument.deleteMany).toHaveBeenCalledWith({ where: { ownerId: USER_ID } });
    expect(m.prisma.applicantProfile.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(m.prisma.user.deleteMany).toHaveBeenCalledWith({ where: { id: USER_ID } });
    expect(m.supabase.auth.admin.deleteUser).toHaveBeenCalledWith(USER_ID);
    expect(m.prisma.application.create).not.toHaveBeenCalled();
  });

  it("refuses a closed job before creating any auth user", async () => {
    m.prisma.jobPosting.findUnique.mockResolvedValueOnce({ id: 5, status: "CLOSED" });
    await expect(createWalkIn(TA, baseInput(), FILE)).rejects.toThrow("no longer accepting applications");
    expect(m.supabase.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("refuses a job the TA does not own, before any write", async () => {
    m.assertOwns.mockRejectedValueOnce(new Error("Job posting not found"));
    await expect(createWalkIn(TA, baseInput(), FILE)).rejects.toThrow("Job posting not found");
    expect(m.assertOwns).toHaveBeenCalledWith("job", 5, TA);
    expect(m.supabase.auth.admin.createUser).not.toHaveBeenCalled();
    expect(m.prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects a non-Philippine mobile before creating anything", async () => {
    await expect(createWalkIn(TA, baseInput({ mobileNumber: "12345" }), FILE)).rejects.toThrow(
      "Enter a valid Philippine mobile number"
    );
    expect(m.supabase.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("refuses a phone that already belongs to an applicant, as a conflict", async () => {
    m.prisma.user.findFirst.mockResolvedValueOnce({ id: "other-user" });
    const error = await createWalkIn(TA, baseInput(), FILE).catch((e) => e);
    expect(error).toBeInstanceOf(WalkInConflictError);
    expect(error.message).toMatch(/already belongs to an applicant/);
    expect(m.supabase.auth.admin.createUser).not.toHaveBeenCalled();
  });
});

describe("createWalkIn: bio-data extraction", () => {
  it("parses the bio-data as WALK_IN and fills blanks for a new person before scoring", async () => {
    await createWalkIn(TA, baseInput(), FILE);
    await vi.waitFor(() => expect(m.revalidateApplication).toHaveBeenCalledWith(42, 5));
    expect(m.parseResumeToProposal).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: 9, buffer: FILE.buffer, source: "WALK_IN", sha256: expect.stringMatching(/^[0-9a-f]{64}$/) })
    );
    expect(m.fillBlanksFromParse).toHaveBeenCalledWith(77, expect.any(String));
    expect(m.fillBlanksFromParse.mock.invocationCallOrder[0]).toBeLessThan(m.revalidateApplication.mock.invocationCallOrder[0]);
    expect(m.enqueueResumeAnalysis).toHaveBeenCalledWith(42);
  });

  it("never rewrites the TA-typed identity fields itself", async () => {
    await createWalkIn(TA, baseInput(), FILE);
    await vi.waitFor(() => expect(m.fillBlanksFromParse).toHaveBeenCalled());
    expect(m.prisma.applicantProfile.update).not.toHaveBeenCalled();
    expect(m.prisma.applicantProfile.create).toHaveBeenCalledTimes(1);
  });

  it("leaves the proposal pending for an existing person", async () => {
    m.prisma.user.findUnique.mockResolvedValueOnce({
      id: "existing-1", role: "APPLICANT", phoneNumber: null,
      applicantProfile: { firstName: "Juan", middleName: "Santos", lastName: "Dela Cruz", mobileNumber: "09171234567", dateOfBirth: new Date() },
    });
    await createWalkIn(TA, baseInput({ existingUserId: "existing-1" }), FILE);
    await vi.waitFor(() => expect(m.revalidateApplication).toHaveBeenCalled());
    expect(m.parseResumeToProposal).toHaveBeenCalledWith(expect.objectContaining({ source: "WALK_IN" }));
    expect(m.fillBlanksFromParse).not.toHaveBeenCalled();
  });

  it("still succeeds and scores when extraction fails", async () => {
    m.parseResumeToProposal.mockRejectedValue(new Error("gemini down"));
    const slip = await createWalkIn(TA, baseInput(), FILE);
    expect(slip.applicationId).toBe(42);
    await vi.waitFor(() => expect(m.revalidateApplication).toHaveBeenCalledWith(42, 5));
    expect(m.fillBlanksFromParse).not.toHaveBeenCalled();
    expect(m.enqueueResumeAnalysis).toHaveBeenCalledWith(42);
  });
});

describe("createWalkIn: reusing an existing applicant", () => {
  const existingUser = (applicantProfile: Record<string, unknown> | null, over: Record<string, unknown> = {}) => ({
    id: "existing-1",
    role: "APPLICANT",
    phoneNumber: null as string | null,
    applicantProfile,
    ...over,
  });

  it("creates no user and fills only the blank profile fields, never names or an existing mobile", async () => {
    m.prisma.user.findUnique.mockResolvedValueOnce(
      existingUser({ firstName: "Maria", middleName: null, lastName: "Reyes", mobileNumber: "09181234567", dateOfBirth: null })
    );
    await createWalkIn(
      TA,
      baseInput({
        existingUserId: "existing-1",
        firstName: "Mariah",
        middleName: "Ann",
        lastName: "Santos",
        mobileNumber: "0917 123 4567",
        birthDate: "1990-05-09",
      }),
      FILE
    );

    expect(m.supabase.auth.admin.createUser).not.toHaveBeenCalled();
    expect(m.prisma.user.create).not.toHaveBeenCalled();
    expect(m.prisma.applicantProfile.create).not.toHaveBeenCalled();

    const fill = m.prisma.applicantProfile.update.mock.calls[0][0].data;
    expect(fill.middleName).toBe("Ann");
    expect(fill.dateOfBirth).toEqual(new Date("1990-05-08T16:00:00Z"));
    expect(fill).not.toHaveProperty("firstName");
    expect(fill).not.toHaveProperty("lastName");
    expect(fill).not.toHaveProperty("mobileNumber");
  });

  it("does not touch the profile at all when every field is already filled", async () => {
    m.prisma.user.findUnique.mockResolvedValueOnce(
      existingUser({ firstName: "Maria", middleName: "Ann", lastName: "Reyes", mobileNumber: "09181234567", dateOfBirth: new Date("1980-01-01T00:00:00Z") })
    );
    await createWalkIn(TA, baseInput({ existingUserId: "existing-1" }), FILE);
    expect(m.prisma.applicantProfile.update).not.toHaveBeenCalled();
  });

  it("adds the phone to the account when it had none and no other account holds it", async () => {
    m.prisma.user.findUnique.mockResolvedValueOnce(
      existingUser({ firstName: "Maria", middleName: "Ann", lastName: "Reyes", mobileNumber: "09181234567", dateOfBirth: new Date("1980-01-01T00:00:00Z") }, { phoneNumber: null })
    );
    await createWalkIn(TA, baseInput({ existingUserId: "existing-1", mobileNumber: "0917 123 4567" }), FILE);
    expect(m.prisma.user.update).toHaveBeenCalledWith({ where: { id: "existing-1" }, data: { phoneNumber: "+639171234567" } });
  });

  it("records the reuse in the audit trail", async () => {
    m.prisma.user.findUnique.mockResolvedValueOnce(existingUser({ firstName: "Maria", middleName: "Ann", lastName: "Reyes", mobileNumber: "09181234567", dateOfBirth: new Date() }));
    await createWalkIn(TA, baseInput({ existingUserId: "existing-1" }), FILE);
    expect(m.logAudit).toHaveBeenCalledWith("ta-1", "WALK_IN_ENCODED", "Application", 42, {
      source: "WALK_IN",
      reusedExistingUser: true,
    });
  });

  it("refuses a user id that is not an applicant", async () => {
    m.prisma.user.findUnique.mockResolvedValueOnce(existingUser(null, { role: "TALENT_ACQUISITION" }));
    await expect(createWalkIn(TA, baseInput({ existingUserId: "existing-1" }), FILE)).rejects.toThrow("Applicant not found");
    expect(m.prisma.application.create).not.toHaveBeenCalled();
  });

  it("stops when the person already has an active application for this job", async () => {
    m.prisma.user.findUnique.mockResolvedValueOnce(existingUser({ firstName: "Maria", middleName: "Ann", lastName: "Reyes", mobileNumber: "09181234567", dateOfBirth: new Date() }));
    m.assertCanApply.mockRejectedValueOnce(new Error("You already have an active application for this job"));
    await expect(createWalkIn(TA, baseInput({ existingUserId: "existing-1" }), FILE)).rejects.toThrow(
      "You already have an active application for this job"
    );
    expect(m.prisma.application.create).not.toHaveBeenCalled();
    expect(m.prisma.applicantProfile.update).not.toHaveBeenCalled();
  });
});

describe("reissueSlip", () => {
  it("rotates the token: the old slip stops working, the new one opens the tracker, and the code stays the same", async () => {
    const row = applicationRow({ trackingCode: "WLK-2026-0042", trackingTokenHash: hashToken(TOKEN) });
    m.prisma.application.findUnique.mockImplementation(async () => row);
    m.prisma.application.update.mockImplementation(async ({ data }: any) => {
      Object.assign(row, data);
      return { ...row };
    });

    const slip = await reissueSlip(TA, 42);

    expect(slip.trackingCode).toBe("WLK-2026-0042");
    expect(slip.trackingToken).not.toBe(TOKEN);
    expect(await getPublicTracking("WLK-2026-0042", TOKEN)).toBeNull();
    expect(await getPublicTracking("WLK-2026-0042", slip.trackingToken)).toMatchObject({ trackingCode: "WLK-2026-0042" });
    expect(m.logAudit).toHaveBeenCalledWith("ta-1", "WALK_IN_SLIP_REISSUED", "Application", 42, { source: "WALK_IN" });
  });

  it("refuses an application the TA does not own, before reading or writing it", async () => {
    m.assertOwns.mockRejectedValueOnce(new Error("Application not found"));
    await expect(reissueSlip(TA, 42)).rejects.toThrow("Application not found");
    expect(m.prisma.application.findUnique).not.toHaveBeenCalled();
    expect(m.prisma.application.update).not.toHaveBeenCalled();
  });

  it("refuses an online application, which has no slip", async () => {
    m.prisma.application.findUnique.mockResolvedValueOnce({ id: 42, source: "ONLINE", trackingCode: null });
    await expect(reissueSlip(TA, 42)).rejects.toBeInstanceOf(WalkInConflictError);
    expect(m.prisma.application.update).not.toHaveBeenCalled();
  });
});

describe("getPublicTracking", () => {
  const trackingRow = (over: Record<string, unknown> = {}) =>
    applicationRow({
      trackingTokenHash: hashToken(TOKEN),
      // The profile carries contact details. The service must not expose any of them.
      user: {
        applicantProfile: {
          firstName: "Juan",
          middleName: "Santos",
          lastName: "Dela Cruz",
          mobileNumber: "09171234567",
          email: "juan@example.com",
          address: "12 Rizal St",
          score: 88,
          notes: "strong forklift experience",
        },
      },
      ...over,
    });

  it("returns the public fields only, with the applicant shown as first name and last initial", async () => {
    m.prisma.application.findUnique.mockResolvedValueOnce(trackingRow());
    const result = await getPublicTracking("WLK-2026-0042", TOKEN);
    expect(Object.keys(result!).sort()).toEqual([
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
    expect(result).toEqual({
      trackingCode: "WLK-2026-0042",
      applicantName: "Juan D.",
      jobTitle: "Forklift Operator",
      clientName: "Acme Logistics",
      status: "SUBMITTED",
      appliedAt: "2026-10-22T01:00:00.000Z",
      nextInterview: null,
      venue: "Cebu City",
      updatedAt: "2026-10-22T03:00:00.000Z",
    });
  });

  it("reads only the name fields and the upcoming active interview from the database", async () => {
    m.prisma.application.findUnique.mockResolvedValueOnce(trackingRow());
    await getPublicTracking("WLK-2026-0042", TOKEN);
    const args = m.prisma.application.findUnique.mock.calls[0][0];
    expect(args.where).toEqual({ trackingCode: "WLK-2026-0042" });
    expect(args.select.user.select.applicantProfile.select).toEqual({ firstName: true, lastName: true });
    // A decided interview (PASS, FAIL, NO_SHOW) or one already conducted must not show as the next one.
    expect(args.select.interviews.where).toEqual({
      isActive: true,
      scheduledAt: { gt: expect.any(Date) },
      conductedAt: null,
      OR: [{ result: null }, { result: { in: ["PENDING", "SCHEDULED"] } }],
    });
    expect(args.select.interviews.take).toBe(1);
  });

  it("shows the next interview when one is scheduled", async () => {
    m.prisma.application.findUnique.mockResolvedValueOnce(
      trackingRow({ interviews: [{ type: "FINAL", scheduledAt: new Date("2026-10-25T01:00:00Z") }] })
    );
    const result = await getPublicTracking("WLK-2026-0042", TOKEN);
    expect(result!.nextInterview).toEqual({ type: "FINAL", scheduledAt: "2026-10-25T01:00:00.000Z" });
  });

  it("exposes no phone, email, address, score or notes anywhere in the payload", async () => {
    m.prisma.application.findUnique.mockResolvedValueOnce(trackingRow());
    const json = JSON.stringify(await getPublicTracking("WLK-2026-0042", TOKEN));
    for (const leaked of ["09171234567", "639171234567", "juan@example.com", "12 Rizal", "strong forklift", "Dela Cruz", "Santos", "88"]) {
      expect(json).not.toContain(leaked);
    }
  });

  it("returns null for a wrong token", async () => {
    m.prisma.application.findUnique.mockResolvedValueOnce(trackingRow());
    expect(await getPublicTracking("WLK-2026-0042", "Wrong_token_value_123")).toBeNull();
  });

  it("returns null for an unknown code", async () => {
    m.prisma.application.findUnique.mockResolvedValueOnce(null);
    expect(await getPublicTracking("WLK-2026-9999", TOKEN)).toBeNull();
  });

  it("returns null for an online application, which has no tracking token", async () => {
    m.prisma.application.findUnique.mockResolvedValueOnce(trackingRow({ trackingTokenHash: null, source: "ONLINE" }));
    expect(await getPublicTracking("WLK-2026-0042", TOKEN)).toBeNull();
  });

  it("answers a lowercase code by its uppercase form", async () => {
    m.prisma.application.findUnique.mockResolvedValueOnce(trackingRow());
    await getPublicTracking("  wlk-2026-0042 ", TOKEN);
    expect(m.prisma.application.findUnique.mock.calls[0][0].where).toEqual({ trackingCode: "WLK-2026-0042" });
  });

  it("returns null without querying when the code or token is missing", async () => {
    expect(await getPublicTracking("", TOKEN)).toBeNull();
    expect(await getPublicTracking("WLK-2026-0042", "")).toBeNull();
    expect(m.prisma.application.findUnique).not.toHaveBeenCalled();
  });

  it("returns null without querying when the code or token is oversized", async () => {
    expect(await getPublicTracking("W".repeat(41), TOKEN)).toBeNull();
    expect(await getPublicTracking("WLK-2026-0042", "t".repeat(101))).toBeNull();
    expect(m.prisma.application.findUnique).not.toHaveBeenCalled();
  });

  it("falls back to a generic name when the applicant has no profile", async () => {
    m.prisma.application.findUnique.mockResolvedValueOnce(trackingRow({ user: { applicantProfile: null } }));
    const result = await getPublicTracking("WLK-2026-0042", TOKEN);
    expect(result!.applicantName).toBe("Applicant");
  });
});

describe("calculateMRFFulfillment counts walk-in deployments", () => {
  const DEPLOYMENTS = [
    { id: 1, status: "ACTIVE", application: { source: "ONLINE" } },
    { id: 2, status: "READY_FOR_DEPLOYMENT", application: { source: "WALK_IN" } },
    { id: 3, status: "ENDED", application: { source: "WALK_IN" } },
  ];

  // Answers the MRF query the way the database would: keep deployments whose status is in the requested list.
  const mrfWith = (headcount: number, deployments: typeof DEPLOYMENTS) => {
    m.prisma.manpowerRequest.findUnique.mockImplementation(async (args: any) => {
      if (args.select?.deployments) {
        const statuses: string[] = args.select.deployments.where.status.in;
        return {
          id: 1,
          headcount,
          deployments: deployments.filter((d) => statuses.includes(d.status)).map(({ id }) => ({ id })),
        };
      }
      return { id: 1, title: "Forklift crew", status: "OPEN", headcount, createdById: "ta-1", client: { id: 3, name: "Acme Logistics" } };
    });
  };

  it("counts a walk-in deployment the same as an online one and ignores ENDED", async () => {
    mrfWith(2, DEPLOYMENTS);
    const stats = await calculateMRFFulfillment(1);
    expect(stats).toEqual({ mrfId: 1, headcount: 2, deployedCount: 2, remainingCount: 0, fulfillmentRate: 100, isFulfilled: true });
  });

  it("does not filter deployments by application source", async () => {
    mrfWith(2, DEPLOYMENTS);
    await calculateMRFFulfillment(1);
    const deploymentWhere = m.prisma.manpowerRequest.findUnique.mock.calls[0][0].select.deployments.where;
    expect(JSON.stringify(deploymentWhere)).not.toMatch(/source/);
  });

  it("fills the MRF when only walk-in deployments reach the headcount", async () => {
    mrfWith(1, [{ id: 7, status: "ACTIVE", application: { source: "WALK_IN" } }]);
    const stats = await calculateMRFFulfillment(1);
    expect(stats.isFulfilled).toBe(true);
    expect(stats.deployedCount).toBe(1);
  });

  it("moves the MRF to FILLED and closes its open jobs once a walk-in deployment completes the headcount", async () => {
    mrfWith(2, DEPLOYMENTS);
    m.prisma.jobPosting.findMany.mockResolvedValueOnce([{ id: 5 }]);
    m.prisma.jobPosting.updateMany.mockResolvedValueOnce({ count: 1 });
    m.prisma.manpowerRequest.update.mockImplementationOnce(async ({ data }: any) => ({
      id: 1,
      title: "Forklift crew",
      status: data.status,
      client: { id: 3, name: "Acme Logistics" },
    }));

    const result = await syncMRFFulfillmentStatus(1, "ta-1");

    expect(result.newStatus).toBe("FILLED");
    expect(m.prisma.jobPosting.updateMany).toHaveBeenCalledWith({ where: { id: { in: [5] } }, data: { status: "CLOSED" } });
    expect(m.prisma.manpowerRequest.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "FILLED" } }));
  });
});
