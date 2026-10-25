import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";

// Self check-in (Phase 2). Every database, auth, storage, queue, audit and notification call is mocked, so nothing
// reaches the hosted database. The check-in table is a small in-memory store: the queue, dedupe and claim rules run
// against real Prisma-style where clauses, so a second confirm or an expired row really matches nothing.
const m = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    prisma: {
      jobPosting: { findUnique: fn(), findMany: fn() },
      walkInCheckIn: { create: fn(), aggregate: fn(), findUnique: fn(), findFirst: fn(), findMany: fn(), update: fn(), updateMany: fn() },
      user: { create: fn(), findFirst: fn(), findUnique: fn() },
      applicantProfile: { create: fn(), update: fn(), updateMany: fn(), deleteMany: fn() },
      application: { count: fn(), create: fn(), findUnique: fn(), update: fn() },
      storedDocument: { deleteMany: fn() },
      $transaction: fn(),
    } as Record<string, any>,
    supabase: { auth: { admin: { createUser: fn(), deleteUser: fn() } }, storage: { from: fn() } },
    storage: { upload: fn(), download: fn(), remove: fn() },
    ensureBucketExists: fn(),
    uploadFileToSupabaseWithInfo: fn(),
    logAudit: fn(),
    sendNotification: fn(),
    enqueueResumeAnalysis: fn(),
    trackFitRevalidation: fn(),
    revalidateApplication: fn(),
    assertCanApply: fn(),
    resolveInitialStatus: fn(),
    generateComplianceRequirementsFromMRF: fn(),
    reuseValidSameClientDocuments: fn(),
    createWalkIn: fn(),
  };
});

vi.mock("../utils/prisma.js", () => ({ default: m.prisma }));
vi.mock("../utils/supabase.js", () => ({ default: m.supabase }));
vi.mock("../middleware/upload.middleware.js", () => ({ uploadFileToSupabaseWithInfo: m.uploadFileToSupabaseWithInfo, ensureBucketExists: m.ensureBucketExists }));
vi.mock("../utils/audit.js", () => ({ logAudit: m.logAudit }));
// notifyOwner skips the actor, then sends to the owner; mirror that so the assertions below read the final send.
vi.mock("../utils/notification.js", () => ({
  notifyJobOwner: vi.fn(async () => 0),
  notifyOwner: vi.fn(async (ownerId: string | null, title: string, message: string, type: string, link: string, options?: { excludeUserId?: string }) => {
    if (ownerId && ownerId !== options?.excludeUserId) await m.sendNotification(ownerId, title, message, type, link);
  }),
  sendNotification: m.sendNotification,
  sendRoleNotification: vi.fn(),
}));
vi.mock("../workers/resume.worker.js", () => ({ enqueueResumeAnalysis: m.enqueueResumeAnalysis, trackFitRevalidation: m.trackFitRevalidation }));
vi.mock("../services/scoring/scoring-configuration.service.js", () => ({ revalidateApplication: m.revalidateApplication }));
vi.mock("../services/applicant/application.service.js", () => ({ assertCanApply: m.assertCanApply, resolveInitialStatus: m.resolveInitialStatus }));
vi.mock("../services/ta/ta.compliance.service.js", () => ({
  generateComplianceRequirementsFromMRF: m.generateComplianceRequirementsFromMRF,
  reuseValidSameClientDocuments: m.reuseValidSameClientDocuments,
}));
// The real walk-in service stays in place; only createWalkIn is wrapped so each call's arguments can be inspected.
vi.mock("../services/ta/walk-in.service.js", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  createWalkIn: m.createWalkIn,
}));

import { confirmCheckIn, createCheckIn, dismissCheckIn, getCheckInStatus, getPendingCheckIn, listPendingCheckIns, purgeExpiredBiodata, CheckInInputError } from "../services/ta/walk-in-check-in.service.js";
import { WalkInConflictError, hashToken } from "../services/ta/walk-in.service.js";
import { owns } from "../services/ta/ownership.js";
import { checkInSchema } from "../schemas/check-in.schema.js";
import { confirmCheckInHandler, dismissCheckInHandler, getCheckInBiodataHandler, listCheckInsHandler } from "../controllers/ta/ta.check-in.controller.js";

const actualWalkIn = await vi.importActual<typeof import("../services/ta/walk-in.service.js")>("../services/ta/walk-in.service.js");

type Row = Record<string, any>;

// ---------- in-memory store and a small Prisma where / select evaluator ----------

const objects = new Map<string, Buffer>();

const db = {
  jobs: [] as Row[],
  users: [] as Row[],
  profiles: [] as Row[],
  checkIns: [] as Row[],
  applications: [] as Row[],
  nextCheckInId: 1,
  nextApplicationId: 42,
};

const sameValue = (a: unknown, b: unknown): boolean => (a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b);
const isPlainObject = (value: unknown): value is Row => value !== null && typeof value === "object" && !(value instanceof Date) && !Array.isArray(value);

const matchValue = (value: any, cond: any): boolean => {
  if (cond === null) return value === null || value === undefined;
  if (!isPlainObject(cond)) return sameValue(value, cond);
  return Object.entries(cond).every(([op, arg]: [string, any]) => {
    switch (op) {
      case "in": return (arg as unknown[]).some((item) => sameValue(value, item));
      case "gt": return value > arg;
      case "lt": return value < arg;
      case "not": return arg === null ? value !== null && value !== undefined : !sameValue(value, arg);
      case "is": return arg === null ? value === null || value === undefined : value !== null && value !== undefined && matchRow(value, arg);
      case "some": return Array.isArray(value) && value.some((item) => matchRow(item, arg));
      case "contains": return String(value ?? "").toLowerCase().includes(String(arg).toLowerCase());
      case "mode": return true;
      default: throw new Error(`fake db: unsupported where operator "${op}"`);
    }
  });
};

const matchRow = (row: Row | null | undefined, where?: Row): boolean => {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => {
    if (key === "AND") return (cond as Row[]).every((part) => matchRow(row, part));
    if (key === "OR") return (cond as Row[]).some((part) => matchRow(row, part));
    return matchValue(row?.[key], cond);
  });
};

// Applies a Prisma `select` (or `include`) to one row, including nested relation selects.
const project = (row: Row | null, select?: Row): Row | null => {
  if (!row || !select) return row;
  const out: Row = {};
  for (const [key, sel] of Object.entries(select)) {
    if (sel === false) continue;
    const value = row[key];
    if (sel === true) {
      out[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      let items = value.filter((item) => matchRow(item, sel.where));
      if (sel.take !== undefined) items = items.slice(0, sel.take);
      out[key] = items.map((item) => project(item, sel.select) ?? item);
    } else {
      out[key] = value == null ? null : (project(value, sel.select) ?? value);
    }
  }
  return out;
};

const shape = (row: Row | null, args: { select?: Row; include?: Row }): Row | null => {
  if (!row) return null;
  if (args.select) return project(row, args.select);
  if (args.include) return { ...row, ...project(row, args.include) };
  return row;
};

const sortRows = (rows: Row[], orderBy?: Row): Row[] => {
  if (!orderBy) return rows;
  const [key, direction] = Object.entries(orderBy)[0];
  const sign = direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => (a[key] > b[key] ? sign : a[key] < b[key] ? -sign : 0));
};

const jobOf = (id: number | null | undefined): Row | null => db.jobs.find((job) => job.id === id) ?? null;
const profileOf = (userId: string): Row | null => db.profiles.find((profile) => profile.userId === userId) ?? null;
const checkInView = (row: Row): Row => ({ ...row, jobPosting: jobOf(row.jobPostingId) });
const applicationView = (row: Row): Row => ({
  ...row,
  interviews: row.interviews ?? [],
  jobPosting: jobOf(row.jobPostingId),
  user: { applicantProfile: profileOf(row.userId) },
});

const uniqueViolation = () => Object.assign(new Error("Unique constraint failed on the fields: (`queueDate`,`queueSeq`)"), { code: "P2002" });

// Wires every fake Prisma method, auth call and side effect. Called after resetAllMocks in each test.
const wire = () => {
  const p = m.prisma;
  p.$transaction.mockImplementation(async (fn: any) => fn(p));

  p.jobPosting.findUnique.mockImplementation(async ({ where, select }: any) => project(jobOf(where.id), select));
  p.jobPosting.findMany.mockImplementation(async ({ where, orderBy, take, select }: any) => {
    const rows = sortRows(db.jobs.filter((job) => matchRow(job, where)), orderBy);
    return (take === undefined ? rows : rows.slice(0, take)).map((job) => project(job, select));
  });

  p.walkInCheckIn.create.mockImplementation(async ({ data, select }: any) => {
    const clash = db.checkIns.some((row) => sameValue(row.queueDate, data.queueDate) && row.queueSeq === data.queueSeq);
    if (clash) throw uniqueViolation();
    const row: Row = {
      id: db.nextCheckInId++,
      publicId: crypto.randomUUID(),
      status: "PENDING",
      middleName: null,
      mobileNumber: null,
      confirmedById: null,
      applicationId: null,
      dismissedById: null,
      dismissReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
    db.checkIns.push(row);
    return project(checkInView(row), select);
  });
  p.walkInCheckIn.aggregate.mockImplementation(async ({ where }: any) => {
    const seqs = db.checkIns.filter((row) => matchRow(row, where)).map((row) => row.queueSeq);
    return { _max: { queueSeq: seqs.length ? Math.max(...seqs) : null } };
  });
  const findOne = async ({ where, select }: any) => project(db.checkIns.map(checkInView).find((row) => matchRow(row, where)) ?? null, select);
  p.walkInCheckIn.findUnique.mockImplementation(findOne);
  p.walkInCheckIn.findFirst.mockImplementation(findOne);
  p.walkInCheckIn.findMany.mockImplementation(async ({ where, select, orderBy, take }: any) => {
    const rows = sortRows(db.checkIns.map(checkInView).filter((row) => matchRow(row, where)), orderBy);
    return (take === undefined ? rows : rows.slice(0, take)).map((row) => project(row, select));
  });
  p.walkInCheckIn.update.mockImplementation(async ({ where, data, select }: any) => {
    const stored = db.checkIns.find((row) => matchRow(checkInView(row), where));
    if (!stored) throw new Error("Record to update not found.");
    Object.assign(stored, data, { updatedAt: new Date() });
    return project(checkInView(stored), select);
  });
  p.walkInCheckIn.updateMany.mockImplementation(async ({ where, data }: any) => {
    const hits = db.checkIns.filter((row) => matchRow(checkInView(row), where));
    hits.forEach((row) => Object.assign(row, data, { updatedAt: new Date() }));
    return { count: hits.length };
  });

  p.user.findFirst.mockImplementation(async ({ where }: any) => db.users.find((user) => matchRow(user, where)) ?? null);
  p.user.findUnique.mockImplementation(async ({ where, select }: any) => project(db.users.find((user) => matchRow(user, where)) ?? null, select));
  p.user.create.mockImplementation(async ({ data }: any) => {
    db.users.push({ ...data });
    return { id: data.id };
  });
  p.applicantProfile.create.mockImplementation(async ({ data }: any) => {
    db.profiles.push({ ...data });
    return data;
  });
  p.applicantProfile.updateMany.mockImplementation(async ({ where, data }: any) => {
    const hits = db.profiles.filter((row) => matchRow(row, where));
    hits.forEach((row) => Object.assign(row, data));
    return { count: hits.length };
  });
  p.applicantProfile.update.mockResolvedValue({});
  p.applicantProfile.deleteMany.mockResolvedValue({ count: 0 });
  p.storedDocument.deleteMany.mockResolvedValue({ count: 0 });

  p.application.count.mockImplementation(async ({ where }: any) => db.applications.map(applicationView).filter((row) => matchRow(row, where)).length);
  p.application.create.mockImplementation(async ({ data }: any) => {
    const row: Row = {
      id: db.nextApplicationId++,
      trackingCode: null,
      trackingTokenHash: null,
      status: "SUBMITTED",
      selfEncoded: false,
      source: "WALK_IN",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
    db.applications.push(row);
    return { ...row };
  });
  p.application.update.mockImplementation(async ({ where, data, include, select }: any) => {
    const stored = db.applications.find((row) => row.id === where.id);
    if (!stored) throw new Error("Record to update not found.");
    Object.assign(stored, data, { updatedAt: new Date() });
    return shape(applicationView(stored), { select, include });
  });
  p.application.findUnique.mockImplementation(async ({ where, select }: any) => {
    const stored = db.applications.find((row) => row.id === where.id);
    return stored ? project(applicationView(stored), select) : null;
  });

  m.supabase.auth.admin.createUser.mockImplementation(async () => ({ data: { user: { id: crypto.randomUUID() } }, error: null }));
  m.supabase.auth.admin.deleteUser.mockResolvedValue({ data: null, error: null });
  // Private bucket stand-in: object path -> bytes.
  objects.clear();
  m.supabase.storage.from.mockReturnValue(m.storage);
  m.ensureBucketExists.mockResolvedValue(undefined);
  m.storage.upload.mockImplementation(async (path: string, body: Buffer) => (objects.set(path, body), { data: { path }, error: null }));
  m.storage.download.mockImplementation(async (path: string) => {
    const bytes = objects.get(path);
    return bytes
      ? { data: { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) }, error: null }
      : { data: null, error: new Error("Object not found") };
  });
  m.storage.remove.mockImplementation(async (paths: string[]) => (paths.forEach((path) => objects.delete(path)), { data: [], error: null }));
  m.uploadFileToSupabaseWithInfo.mockResolvedValue({ url: "https://storage.example/applicant-assets/biodata.pdf", documentId: 42, sha256: "b".repeat(64) });
  m.assertCanApply.mockImplementation(async (_userId: string, jobId: number) => ({ id: jobId, status: "OPEN", mrf: { clientId: 3 } }));
  m.resolveInitialStatus.mockResolvedValue({ status: "SUBMITTED", attemptNumber: 1, sameClientDeployment: false, sameClientDeployments: [] });
  m.enqueueResumeAnalysis.mockResolvedValue(undefined);
  m.trackFitRevalidation.mockReturnValue(undefined);
  m.revalidateApplication.mockResolvedValue(undefined);
  m.generateComplianceRequirementsFromMRF.mockResolvedValue(undefined);
  m.reuseValidSameClientDocuments.mockResolvedValue(undefined);
  m.logAudit.mockResolvedValue(undefined);
  m.sendNotification.mockResolvedValue(undefined);
  m.createWalkIn.mockImplementation((...args: any[]) => (actualWalkIn.createWalkIn as any)(...args));
};

const seed = () => {
  db.jobs.push(
    { id: 5, title: "Forklift Operator", location: "Cebu City", status: "OPEN", postedById: "ta-owner", mrfId: 9, mrf: { id: 9, assignedTaId: "ta-owner", client: { name: "Acme Logistics" } } },
    { id: 6, title: "Welder", location: "Laguna", status: "CLOSED", postedById: "ta-owner", mrfId: null, mrf: null },
    { id: 7, title: "Cook", location: null, status: "OPEN", postedById: "ta-owner", mrfId: null, mrf: null },
  );
  db.users.push(
    { id: "ta-owner", email: "dela.cruz@megs.ph", role: "TALENT_ACQUISITION", phoneNumber: null, applicantProfile: null },
    { id: "ta-desk", email: "desk.ta@megs.ph", role: "TALENT_ACQUISITION", phoneNumber: null, applicantProfile: null },
  );
};

// Pinned clock: 2026-10-22 10:00 in Manila.
const NOW = new Date("2026-10-22T02:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const TA_OWNER = { id: "ta-owner", role: "TALENT_ACQUISITION" };
const TA_DESK = { id: "ta-desk", role: "TALENT_ACQUISITION" };
const FILE = {
  buffer: Buffer.from("%PDF-1.4 biodata"),
  mimetype: "application/pdf",
  originalname: "biodata.pdf",
  size: 16,
} as unknown as Express.Multer.File;

const submit = (over: Record<string, unknown> = {}) =>
  (createCheckIn as (input: any) => Promise<any>)({
    jobPostingId: 5,
    firstName: "Juan",
    middleName: "Santos",
    lastName: "Dela Cruz",
    mobileNumber: "0917 123 4567",
    birthDate: "1990-05-09",
    ...over,
  } as any);

const confirmInput = (over: Record<string, unknown> = {}) => ({
  firstName: "Juan",
  middleName: "Santos",
  lastName: "Dela Cruz",
  mobileNumber: "09171234567",
  birthDate: "1990-05-09",
  existingUserId: null,
  ...over,
});

const rowOf = (publicId: string): Row => db.checkIns.find((row) => row.publicId === publicId)!;
const idOf = (publicId: string): number => rowOf(publicId).id;

const makeRes = () => {
  const res: any = { statusCode: 200, body: undefined, headers: {} };
  res.status = (code: number) => ((res.statusCode = code), res);
  res.json = (body: unknown) => ((res.body = body), res);
  res.set = (values: Record<string, string>) => (Object.assign(res.headers, values), res);
  res.send = (body: unknown) => ((res.body = body), res);
  return res;
};

beforeEach(() => {
  vi.resetAllMocks();
  db.jobs.length = 0;
  db.users.length = 0;
  db.profiles.length = 0;
  db.checkIns.length = 0;
  db.applications.length = 0;
  db.nextCheckInId = 1;
  db.nextApplicationId = 42;
  seed();
  wire();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------- 1. createCheckIn ----------

describe("createCheckIn", () => {
  it("numbers the queue A-001 then A-002 within one Manila day", async () => {
    const first = await submit({ firstName: "Juan", lastName: "Dela Cruz" });
    const second = await submit({ firstName: "Ana", lastName: "Reyes", birthDate: "1995-01-02" });
    expect(first.queueNumber).toBe("A-001");
    expect(second.queueNumber).toBe("A-002");
    expect(db.checkIns.map((row) => row.queueSeq)).toEqual([1, 2]);
  });

  it("starts the queue again at A-001 when the Manila day changes", async () => {
    await submit({ firstName: "Juan", lastName: "Dela Cruz" });
    // 2026-10-22 17:00 UTC is 2026-10-23 01:00 in Manila.
    vi.setSystemTime(new Date("2026-10-22T17:00:00Z"));
    const next = await submit({ firstName: "Ana", lastName: "Reyes", birthDate: "1995-01-02" });
    expect(next.queueNumber).toBe("A-001");
    expect(rowOf(next.publicId).queueDate.toISOString()).toBe("2026-10-23T00:00:00.000Z");
  });

  it("retries with the next free number when a concurrent insert takes the same queue number (P2002)", async () => {
    db.checkIns.push({
      id: 900, publicId: crypto.randomUUID(), queueDate: new Date("2026-10-22T00:00:00Z"), queueSeq: 1, jobPostingId: 5,
      firstName: "Seeded", middleName: null, lastName: "Person", mobileNumber: null, birthDate: new Date("1980-01-01T00:00:00Z"),
      status: "PENDING", viewTokenHash: hashToken("seeded"), confirmedById: null, applicationId: null, dismissedById: null,
      dismissReason: null, createdAt: NOW, updatedAt: NOW, expiresAt: new Date(NOW.getTime() + 3 * DAY),
    });
    // The first read is stale (it saw no rows), so the first insert collides with seq 1 and the service must retry.
    m.prisma.walkInCheckIn.aggregate.mockImplementationOnce(async () => ({ _max: { queueSeq: null } }));
    const result = await submit();
    expect(m.prisma.walkInCheckIn.create).toHaveBeenCalledTimes(2);
    expect(result.queueNumber).toBe("A-002");
  });

  it("gives up with a readable input error after five conflicting attempts and creates no row", async () => {
    db.checkIns.push({
      id: 900, publicId: crypto.randomUUID(), queueDate: new Date("2026-10-22T00:00:00Z"), queueSeq: 1, jobPostingId: 5,
      firstName: "Seeded", lastName: "Person", middleName: null, mobileNumber: null, birthDate: new Date("1980-01-01T00:00:00Z"),
      status: "PENDING", viewTokenHash: hashToken("seeded"), confirmedById: null, applicationId: null, dismissedById: null,
      dismissReason: null, createdAt: NOW, updatedAt: NOW, expiresAt: new Date(NOW.getTime() + 3 * DAY),
    });
    m.prisma.walkInCheckIn.aggregate.mockResolvedValue({ _max: { queueSeq: null } });
    await expect(submit()).rejects.toBeInstanceOf(CheckInInputError);
    expect(m.prisma.walkInCheckIn.create).toHaveBeenCalledTimes(5);
    expect(db.checkIns).toHaveLength(1);
  });

  it("refuses a closed job with a CheckInInputError and creates nothing", async () => {
    await expect(submit({ jobPostingId: 6 })).rejects.toThrow(CheckInInputError);
    await expect(submit({ jobPostingId: 6 })).rejects.toThrow("no longer accepting applications");
    expect(db.checkIns).toHaveLength(0);
  });

  it("refuses a job id that does not exist", async () => {
    await expect(submit({ jobPostingId: 999 })).rejects.toThrow(CheckInInputError);
    expect(db.checkIns).toHaveLength(0);
  });

  it("refuses a mobile number that is not a Philippine mobile", async () => {
    await expect(submit({ mobileNumber: "12345" })).rejects.toThrow("valid Philippine mobile number");
    expect(db.checkIns).toHaveLength(0);
  });

  it("says already checked in, with no link and no new token, when the same person is already waiting for the same job today", async () => {
    const first = await submit({ firstName: "Maria", lastName: "Dela Cruz" });
    const second: any = await submit({ firstName: "MARÍA", lastName: "dela  cruz" });
    expect(second).toEqual({ alreadyCheckedIn: true, queueNumber: "A-001" });
    expect(db.checkIns).toHaveLength(1);
    // The original link keeps working and nobody else got one.
    expect(rowOf(first.publicId).viewTokenHash).toBe(hashToken(first.viewToken));
    expect((await getCheckInStatus(first.publicId, first.viewToken))?.status).toBe("PENDING");
  });

  it("does not treat a different birth date as the same person", async () => {
    await submit({ firstName: "Maria", lastName: "Dela Cruz" });
    const other = await submit({ firstName: "Maria", lastName: "Dela Cruz", birthDate: "1991-05-09" });
    expect(other.queueNumber).toBe("A-002");
    expect(db.checkIns).toHaveLength(2);
  });

  it("does not treat the same person for a different job as a duplicate", async () => {
    await submit({ firstName: "Maria", lastName: "Dela Cruz" });
    const other = await submit({ firstName: "Maria", lastName: "Dela Cruz", jobPostingId: 7 });
    expect(other.queueNumber).toBe("A-002");
  });

  it("does not hand back a dismissed check-in as a duplicate", async () => {
    const first = await submit({ firstName: "Maria", lastName: "Dela Cruz" });
    await dismissCheckIn(TA_DESK, idOf(first.publicId), "Left before the call");
    const again = await submit({ firstName: "Maria", lastName: "Dela Cruz" });
    expect(again.publicId).not.toBe(first.publicId);
    expect(again.queueNumber).toBe("A-002");
  });

  it("creates no User, no Application and no auth account; only the check-in row and its link", async () => {
    const result = await submit();
    expect(m.supabase.auth.admin.createUser).not.toHaveBeenCalled();
    expect(m.prisma.user.create).not.toHaveBeenCalled();
    expect(m.prisma.application.create).not.toHaveBeenCalled();
    expect(db.users).toHaveLength(2);
    expect(db.applications).toHaveLength(0);
    expect(result.statusPath).toBe(`/check-in/${result.publicId}?token=${result.viewToken}`);
    expect(rowOf(result.publicId).expiresAt.getTime()).toBe(NOW.getTime() + 3 * DAY);
  });
});

// ---------- 2. submit and confirm schemas ----------

describe("check-in schemas", () => {
  const birthdayFor = (yearsAgo: number, extraDays = 0) => {
    // Manila date today is 2026-10-22; a birthday on 2026-10-22 is completed on that day.
    const year = 2026 - yearsAgo;
    return new Date(Date.UTC(year, 9, 22 + extraDays)).toISOString().slice(0, 10);
  };
  const submitBody = (birthDate: unknown) => ({ body: { jobPostingId: 5, firstName: "Juan", lastName: "Dela Cruz", birthDate } });

  it.each([
    ["18 today", birthdayFor(18)],
    ["65 today", birthdayFor(65)],
    ["64, birthday tomorrow", birthdayFor(65, 1)],
  ])("accepts an applicant who is %s", (_label, birthDate) => {
    expect(checkInSchema.submit.safeParse(submitBody(birthDate)).success).toBe(true);
  });

  it.each([
    ["17, birthday tomorrow", birthdayFor(18, 1)],
    ["66 today", birthdayFor(66)],
    ["66, birthday yesterday", birthdayFor(66, -1)],
  ])("rejects an applicant who is %s", (_label, birthDate) => {
    const result = checkInSchema.submit.safeParse(submitBody(birthDate));
    expect(result.success).toBe(false);
  });

  it("rejects a missing birth date and an impossible calendar date", () => {
    expect(checkInSchema.submit.safeParse(submitBody(undefined)).success).toBe(false);
    expect(checkInSchema.submit.safeParse(submitBody("2000-02-30")).success).toBe(false);
  });

  it("gives the age message when the applicant is outside 18 to 65", () => {
    const result = checkInSchema.submit.safeParse(submitBody(birthdayFor(17)));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("Applicant must be between 18 and 65 years old.");
  });

  it("applies the same age window to the confirm body and rejects a job id smuggled into it", () => {
    const confirmBody = (birthDate: string, extra: Record<string, unknown> = {}) => ({
      params: { id: "7" },
      body: { firstName: "Juan", lastName: "Dela Cruz", birthDate, ...extra },
    });
    expect(checkInSchema.confirm.safeParse(confirmBody(birthdayFor(18))).success).toBe(true);
    expect(checkInSchema.confirm.safeParse(confirmBody(birthdayFor(65))).success).toBe(true);
    expect(checkInSchema.confirm.safeParse(confirmBody(birthdayFor(17, 1))).success).toBe(false);
    expect(checkInSchema.confirm.safeParse(confirmBody(birthdayFor(66))).success).toBe(false);
    expect(checkInSchema.confirm.safeParse(confirmBody(birthdayFor(30), { jobPostingId: 6 })).success).toBe(false);
  });

  it("requires a dismiss reason of 1 to 300 characters after trimming", () => {
    const dismiss = (reason: string) => checkInSchema.dismiss.safeParse({ params: { id: "7" }, body: { reason } });
    expect(dismiss("   ").success).toBe(false);
    expect(dismiss("Left before the call").success).toBe(true);
    expect(dismiss("x".repeat(300)).success).toBe(true);
    expect(dismiss("x".repeat(301)).success).toBe(false);
  });
});

// ---------- 3. getCheckInStatus ----------

describe("getCheckInStatus", () => {
  it("returns null for a wrong token, an unknown check-in and an oversized id or token, without a database call for the last", async () => {
    const created = await submit();
    expect(await getCheckInStatus(created.publicId, "Wrong_token_value_1")).toBeNull();
    expect(await getCheckInStatus(crypto.randomUUID(), created.viewToken)).toBeNull();
    m.prisma.walkInCheckIn.findUnique.mockClear();
    expect(await getCheckInStatus(created.publicId, "t".repeat(101))).toBeNull();
    expect(await getCheckInStatus("x".repeat(65), created.viewToken)).toBeNull();
    expect(m.prisma.walkInCheckIn.findUnique).not.toHaveBeenCalled();
  });

  it("returns null for a pending check-in whose three days have passed", async () => {
    const created = await submit();
    vi.setSystemTime(new Date(NOW.getTime() + 3 * DAY + 1000));
    expect(await getCheckInStatus(created.publicId, created.viewToken)).toBeNull();
  });

  it("returns the queue view with tracking null while the check-in is still pending", async () => {
    const created = await submit();
    const status = await getCheckInStatus(created.publicId, created.viewToken);
    expect(status).toEqual({
      queueNumber: "A-001",
      status: "PENDING",
      firstName: "Juan",
      jobTitle: "Forklift Operator",
      createdAt: NOW.toISOString(),
      expiresAt: new Date(NOW.getTime() + 3 * DAY).toISOString(),
      tracking: null,
    });
  });

  it("returns the tracker payload from getTrackingByApplicationId once CONFIRMED, with no mobile number or birth date", async () => {
    const created = await submit();
    await confirmCheckIn(TA_DESK, idOf(created.publicId), confirmInput(), FILE);

    const status = await getCheckInStatus(created.publicId, created.viewToken);
    expect(Object.keys(status!).sort()).toEqual(["createdAt", "expiresAt", "firstName", "jobTitle", "queueNumber", "status", "tracking"]);
    expect(status!.status).toBe("CONFIRMED");
    expect(Object.keys(status!.tracking!).sort()).toEqual([
      "applicantName", "appliedAt", "clientName", "jobTitle", "nextInterview", "status", "trackingCode", "updatedAt", "venue",
    ]);
    expect(status!.tracking!.trackingCode).toBe("WLK-2026-0042");
    expect(status!.tracking!.applicantName).toBe("Juan D.");
    const json = JSON.stringify(status);
    expect(json).not.toContain("09171234567");
    expect(json).not.toContain("+639171234567");
    expect(json).not.toContain("1990-05-09");
    expect(json).not.toContain("Dela Cruz");
  });

  it("returns the closed state for a dismissed check-in without tracking", async () => {
    const created = await submit();
    await dismissCheckIn(TA_DESK, idOf(created.publicId), "Left before the call");
    const status = await getCheckInStatus(created.publicId, created.viewToken);
    expect(status?.status).toBe("DISMISSED");
    expect(status?.tracking).toBeNull();
  });
});

// ---------- 4. confirmCheckIn ----------

describe("confirmCheckIn", () => {
  it("lets any TA confirm a check-in for a job another TA owns", async () => {
    const created = await submit();
    const slip = await confirmCheckIn(TA_DESK, idOf(created.publicId), confirmInput(), FILE);
    expect(slip.jobTitle).toBe("Forklift Operator");
    expect(rowOf(created.publicId)).toMatchObject({ status: "CONFIRMED", confirmedById: "ta-desk", applicationId: 42 });
  });

  it("runs createWalkIn with the ownership check skipped, selfEncoded on, and the job from the check-in", async () => {
    const created = await submit();
    await confirmCheckIn(TA_DESK, idOf(created.publicId), confirmInput(), FILE);
    expect(m.createWalkIn).toHaveBeenCalledTimes(1);
    expect(m.createWalkIn).toHaveBeenCalledWith(
      TA_DESK,
      expect.objectContaining({ jobPostingId: 5, source: "WALK_IN", birthDate: "1990-05-09" }),
      FILE,
      { skipOwnership: true, selfEncoded: true },
    );
  });

  it("ignores a jobPostingId passed into the service input and uses the one stored on the check-in", async () => {
    const created = await submit({ jobPostingId: 7 });
    await confirmCheckIn(TA_DESK, idOf(created.publicId), { ...confirmInput(), jobPostingId: 6 } as any, FILE);
    expect(m.createWalkIn.mock.calls[0][1]).toMatchObject({ jobPostingId: 7 });
    expect(db.applications[0].jobPostingId).toBe(7);
  });

  it("answers a second confirm with a conflict and does not create a second application", async () => {
    const created = await submit();
    const id = idOf(created.publicId);
    await confirmCheckIn(TA_DESK, id, confirmInput(), FILE);
    const second = confirmCheckIn(TA_OWNER, id, confirmInput(), FILE);
    await expect(second).rejects.toBeInstanceOf(WalkInConflictError);
    expect(m.createWalkIn).toHaveBeenCalledTimes(1);
    expect(db.applications).toHaveLength(1);
  });

  it("refuses to confirm an expired check-in with a conflict and creates nothing", async () => {
    const created = await submit();
    vi.setSystemTime(new Date(NOW.getTime() + 3 * DAY + 1000));
    await expect(confirmCheckIn(TA_DESK, idOf(created.publicId), confirmInput(), FILE)).rejects.toBeInstanceOf(WalkInConflictError);
    expect(m.createWalkIn).not.toHaveBeenCalled();
    expect(rowOf(created.publicId).status).toBe("PENDING");
  });

  it("reports an unknown check-in as not found", async () => {
    await expect(confirmCheckIn(TA_DESK, 99999, confirmInput(), FILE)).rejects.toThrow("Check-in not found");
  });

  it("returns the check-in to PENDING and clears confirmedById when createWalkIn fails, so it can be confirmed again", async () => {
    const created = await submit();
    const id = idOf(created.publicId);
    m.createWalkIn.mockRejectedValueOnce(new Error("Storage upload failed"));
    await expect(confirmCheckIn(TA_DESK, id, confirmInput(), FILE)).rejects.toThrow("Storage upload failed");
    expect(rowOf(created.publicId)).toMatchObject({ status: "PENDING", confirmedById: null, applicationId: null });

    const slip = await confirmCheckIn(TA_OWNER, id, confirmInput(), FILE);
    expect(slip.applicationId).toBe(42);
    expect(rowOf(created.publicId)).toMatchObject({ status: "CONFIRMED", confirmedById: "ta-owner" });
  });

  it("also reverts when createWalkIn refuses the mobile number as already belonging to an applicant", async () => {
    const created = await submit();
    m.createWalkIn.mockRejectedValueOnce(new WalkInConflictError("This mobile number already belongs to an applicant."));
    await expect(confirmCheckIn(TA_DESK, idOf(created.publicId), confirmInput(), FILE)).rejects.toBeInstanceOf(WalkInConflictError);
    expect(rowOf(created.publicId).status).toBe("PENDING");
  });

  it("notifies the job owner when another TA confirmed, with the queue number and a link to the application", async () => {
    const created = await submit();
    await confirmCheckIn(TA_DESK, idOf(created.publicId), confirmInput(), FILE);
    expect(m.sendNotification).toHaveBeenCalledTimes(1);
    expect(m.sendNotification).toHaveBeenCalledWith(
      "ta-owner",
      "Self check-in confirmed",
      expect.stringMatching(/A-001.*Forklift Operator.*another recruiter/),
      "INFO",
      "/ta/applications/42",
    );
  });

  it("sends no notice when the job owner confirms their own job, and still writes the audit entry", async () => {
    const created = await submit();
    await confirmCheckIn(TA_OWNER, idOf(created.publicId), confirmInput(), FILE);
    expect(m.sendNotification).not.toHaveBeenCalled();
    expect(m.logAudit).toHaveBeenCalledWith("ta-owner", "WALK_IN_CHECK_IN_CONFIRMED", "WalkInCheckIn", idOf(created.publicId), {
      applicationId: 42,
      jobOwnerId: "ta-owner",
    });
  });

  it("leaves the application with the job's owner: the confirming TA does not own it, the owner does", async () => {
    const created = await submit();
    const slip = await confirmCheckIn(TA_DESK, idOf(created.publicId), confirmInput(), FILE);
    expect(await owns("application", slip.applicationId, TA_DESK)).toBe(false);
    expect(await owns("application", slip.applicationId, TA_OWNER)).toBe(true);
  });

  it(
    "does not put a check-in back in the queue once its application is already saved ",
    async () => {
      // The applicant row is committed inside createWalkIn, then a later step (the same-client compliance copy) throws.
      // The service reverts to PENDING because it has not linked applicationId yet, so the queue shows a person
      // who already has an application, and a second confirm can encode them again.
      m.resolveInitialStatus.mockResolvedValueOnce({
        status: "SUBMITTED",
        attemptNumber: 2,
        sameClientDeployment: true,
        sameClientDeployments: [{ applicationId: 7 }],
      });
      m.generateComplianceRequirementsFromMRF.mockRejectedValueOnce(new Error("compliance write failed"));
      const created = await submit();
      await expect(confirmCheckIn(TA_DESK, idOf(created.publicId), confirmInput(), FILE)).resolves.toMatchObject({ applicationId: 42 });
      expect(db.applications).toHaveLength(1);
      expect(rowOf(created.publicId).status).not.toBe("PENDING");
    },
  );
});

// ---------- 5. dismissCheckIn ----------

describe("dismissCheckIn", () => {
  it("dismisses a pending check-in with the trimmed reason, records who did it and audits it", async () => {
    const created = await submit();
    const result = await dismissCheckIn(TA_DESK, idOf(created.publicId), "  Left before the call  ");
    expect(result).toEqual({ id: idOf(created.publicId), status: "DISMISSED" });
    expect(rowOf(created.publicId)).toMatchObject({ status: "DISMISSED", dismissedById: "ta-desk", dismissReason: "Left before the call" });
    expect(m.logAudit).toHaveBeenCalledWith("ta-desk", "WALK_IN_CHECK_IN_DISMISSED", "WalkInCheckIn", idOf(created.publicId), {
      reason: "Left before the call",
    });
  });

  it("answers a second dismiss with a conflict", async () => {
    const created = await submit();
    const id = idOf(created.publicId);
    await dismissCheckIn(TA_DESK, id, "Left");
    await expect(dismissCheckIn(TA_OWNER, id, "Left again")).rejects.toBeInstanceOf(WalkInConflictError);
    expect(rowOf(created.publicId).dismissedById).toBe("ta-desk");
  });

  it("refuses to dismiss a check-in that was already confirmed", async () => {
    const created = await submit();
    const id = idOf(created.publicId);
    await confirmCheckIn(TA_DESK, id, confirmInput(), FILE);
    await expect(dismissCheckIn(TA_DESK, id, "Too late")).rejects.toBeInstanceOf(WalkInConflictError);
    expect(rowOf(created.publicId).status).toBe("CONFIRMED");
  });

  it("reports an unknown check-in as not found", async () => {
    await expect(dismissCheckIn(TA_DESK, 99999, "Left")).rejects.toThrow("Check-in not found");
  });
});

// ---------- 6. listPendingCheckIns ----------

describe("listPendingCheckIns", () => {
  it("lists pending, unexpired check-ins oldest first and leaves out expired and non-pending rows", async () => {
    const early = await submit({ firstName: "Early", lastName: "Expired" });
    vi.setSystemTime(new Date(NOW.getTime() + 2 * DAY));
    const waiting = await submit({ firstName: "Ana", lastName: "Reyes", birthDate: "1995-01-02" });
    const dismissed = await submit({ firstName: "Lito", lastName: "Cruz", birthDate: "1985-03-03" });
    await dismissCheckIn(TA_DESK, idOf(dismissed.publicId), "No show");
    // Three days after the first submission: the first is expired, the second still waits.
    vi.setSystemTime(new Date(NOW.getTime() + 3 * DAY + 60 * 1000));
    const listed = await listPendingCheckIns();
    expect(listed.items.map((item) => item.queueNumber)).toEqual([waiting.queueNumber]);
    expect(rowOf(early.publicId).status).toBe("PENDING");
  });

  it("returns the list fields and never a mobile number or birth date", async () => {
    await submit();
    const listed = await listPendingCheckIns();
    expect(listed.items).toHaveLength(1);
    expect(Object.keys(listed.items[0]).sort()).toEqual([
      "clientName", "createdAt", "firstName", "id", "jobPostingId", "jobTitle", "lastName", "middleName", "queueNumber",
    ]);
    expect(listed.items[0]).toMatchObject({ queueNumber: "A-001", jobTitle: "Forklift Operator", clientName: "Acme Logistics" });
    const json = JSON.stringify(listed);
    expect(json).not.toContain("09171234567");
    expect(json).not.toContain("1990-05-09");
  });
});

// ---------- getPendingCheckIn (confirm dialog) ----------

describe("getPendingCheckIn", () => {
  it("returns the local mobile format, the birth date and the job owner's name for the confirm dialog", async () => {
    const created = await submit();
    const detail = await getPendingCheckIn(idOf(created.publicId));
    expect(detail).toMatchObject({
      queueNumber: "A-001",
      mobileNumber: "09171234567",
      birthDate: "1990-05-09",
      jobOwnerName: null,
      jobTitle: "Forklift Operator",
    });
  });

  it("does not return a confirmed check-in to the dialog", async () => {
    const created = await submit();
    await confirmCheckIn(TA_DESK, idOf(created.publicId), confirmInput(), FILE);
    await expect(getPendingCheckIn(idOf(created.publicId))).rejects.toThrow("Check-in not found");
  });
});

// ---------- TA controllers ----------

describe("TA check-in controllers", () => {
  const confirmReq = (id: number | string, over: Record<string, unknown> = {}) => ({
    params: { id: String(id) },
    body: confirmInput(),
    file: FILE,
    user: TA_DESK,
    ...over,
  });

  it("lists the pending check-ins", async () => {
    await submit();
    const res = makeRes();
    await listCheckInsHandler({} as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });

  it("answers 409 to the second TA who confirms the same check-in", async () => {
    const created = await submit();
    const id = idOf(created.publicId);
    const first = makeRes();
    await confirmCheckInHandler(confirmReq(id) as any, first);
    expect(first.statusCode).toBe(201);
    const second = makeRes();
    await confirmCheckInHandler(confirmReq(id, { user: TA_OWNER }) as any, second);
    expect(second.statusCode).toBe(409);
    expect(second.body.success).toBe(false);
  });

  it("answers 404 for an unknown check-in and 400 when the biodata file is missing", async () => {
    const missing = makeRes();
    await confirmCheckInHandler(confirmReq(99999) as any, missing);
    expect(missing.statusCode).toBe(404);

    const created = await submit();
    const noFile = makeRes();
    await confirmCheckInHandler(confirmReq(idOf(created.publicId), { file: undefined }) as any, noFile);
    expect(noFile.statusCode).toBe(400);
    expect(rowOf(created.publicId).status).toBe("PENDING");
  });

  it("answers 409 for a second dismiss", async () => {
    const created = await submit();
    const id = idOf(created.publicId);
    const first = makeRes();
    await dismissCheckInHandler({ params: { id: String(id) }, body: { reason: "Left" }, user: TA_DESK } as any, first);
    expect(first.statusCode).toBe(200);
    const second = makeRes();
    await dismissCheckInHandler({ params: { id: String(id) }, body: { reason: "Left" }, user: TA_DESK } as any, second);
    expect(second.statusCode).toBe(409);
  });

  it("answers 500, not a client error, when the intake fails for a reason that is not the applicant's fault ", async () => {
    const created = await submit();
    m.createWalkIn.mockRejectedValueOnce(new Error("connection reset"));
    const res = makeRes();
    await confirmCheckInHandler(confirmReq(idOf(created.publicId)) as any, res);
    expect(res.statusCode).toBe(500);
  });
});

// ---------- optional biodata held at check-in ----------

const PDF = Buffer.from("%PDF-1.4\nbiodata\n%%EOF");
const heldFile = (over: Record<string, unknown> = {}) =>
  ({ buffer: PDF, mimetype: "application/pdf", originalname: "my biodata.pdf", size: PDF.length, fieldname: "file", ...over }) as unknown as Express.Multer.File;
const submitWithFile = (file = heldFile(), over: Record<string, unknown> = {}) =>
  (createCheckIn as (input: any, file?: Express.Multer.File) => Promise<any>)(
    { jobPostingId: 5, firstName: "Juan", lastName: "Dela Cruz", mobileNumber: "0917 123 4567", birthDate: "1990-05-09", ...over },
    file,
  );

describe("check-in biodata", () => {
  it("stores an attached PDF under check-ins/<publicId>/ and saves the four columns", async () => {
    const created = await submitWithFile();
    const row = rowOf(created.publicId);
    expect(row.biodataStoragePath).toMatch(new RegExp(`^check-ins/${created.publicId}/[0-9a-f-]{36}\\.pdf$`));
    expect(row).toMatchObject({ biodataMimeType: "application/pdf", biodataFileName: "my biodata.pdf", biodataSizeBytes: PDF.length });
    expect(m.supabase.storage.from).toHaveBeenCalledWith("applicant-assets");
    expect(objects.has(row.biodataStoragePath)).toBe(true);
  });

  it("stores nothing and leaves the columns empty when no file is attached", async () => {
    const created = await submit();
    expect(m.storage.upload).not.toHaveBeenCalled();
    expect(rowOf(created.publicId).biodataStoragePath ?? null).toBeNull();
  });

  it("rejects a file that is not a photo or PDF, with a clear message, and creates no row", async () => {
    await expect(submitWithFile(heldFile({ buffer: Buffer.from("MZ not a document"), mimetype: "application/pdf" }))).rejects.toThrow(
      "Use a JPEG, PNG or WEBP photo, or a PDF, under 5 MB.",
    );
    expect(db.checkIns).toHaveLength(0);
    expect(m.storage.upload).not.toHaveBeenCalled();
  });

  it("does not store a new file for an already-checked-in applicant", async () => {
    await submit({ firstName: "Maria" });
    const again = await submitWithFile(heldFile(), { firstName: "Maria" });
    expect(again.alreadyCheckedIn).toBe(true);
    expect(m.storage.upload).not.toHaveBeenCalled();
    expect(objects.size).toBe(0);
  });

  it("deletes the stored object when the row cannot be created", async () => {
    m.prisma.walkInCheckIn.create.mockRejectedValueOnce(new Error("db down"));
    await expect(submitWithFile()).rejects.toThrow("db down");
    expect(m.storage.remove).toHaveBeenCalledTimes(1);
    expect(objects.size).toBe(0);
  });

  it("shows the TA the file name, type and size, or null when none was attached", async () => {
    const withFile = await submitWithFile();
    const without = await submit({ firstName: "Ana", lastName: "Reyes", birthDate: "1995-01-02" });
    expect((await getPendingCheckIn(idOf(withFile.publicId))).biodata).toEqual({ fileName: "my biodata.pdf", mimeType: "application/pdf", sizeBytes: PDF.length });
    expect((await getPendingCheckIn(idOf(without.publicId))).biodata).toBeNull();
  });

  it("confirms with the held file when the TA attaches none, then deletes the held object", async () => {
    const created = await submitWithFile();
    const path = rowOf(created.publicId).biodataStoragePath;
    await confirmCheckIn(TA_DESK, idOf(created.publicId), confirmInput(), undefined);
    const passed = m.createWalkIn.mock.calls[0][2];
    expect(passed).toMatchObject({ fieldname: "file", mimetype: "application/pdf", originalname: "my biodata.pdf", size: PDF.length });
    expect(Buffer.compare(passed.buffer, PDF)).toBe(0);
    expect(objects.has(path)).toBe(false);
    expect(rowOf(created.publicId).biodataStoragePath).toBeNull();
  });

  it("prefers the TA's own file over the held one, and still deletes the held object", async () => {
    const created = await submitWithFile();
    await confirmCheckIn(TA_DESK, idOf(created.publicId), confirmInput(), FILE);
    expect(m.createWalkIn.mock.calls[0][2]).toBe(FILE);
    expect(objects.size).toBe(0);
  });

  it("refuses to confirm with no TA file and no held file, and leaves the check-in pending", async () => {
    const created = await submit();
    await expect(confirmCheckIn(TA_DESK, idOf(created.publicId), confirmInput(), undefined)).rejects.toThrow("Attach the biodata photo or PDF");
    expect(rowOf(created.publicId).status).toBe("PENDING");
    expect(m.createWalkIn).not.toHaveBeenCalled();
  });

  it("answers 400 from the confirm handler when neither file exists", async () => {
    const created = await submit();
    const res = makeRes();
    await confirmCheckInHandler({ params: { id: String(idOf(created.publicId)) }, body: confirmInput(), user: TA_DESK } as any, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns the check-in to pending and keeps the held file when the intake fails", async () => {
    const created = await submitWithFile();
    m.createWalkIn.mockRejectedValueOnce(new Error("Storage upload failed"));
    await expect(confirmCheckIn(TA_DESK, idOf(created.publicId), confirmInput(), undefined)).rejects.toThrow("Storage upload failed");
    expect(rowOf(created.publicId).status).toBe("PENDING");
    expect(objects.size).toBe(1);
  });

  it("deletes the held object when the check-in is dismissed", async () => {
    const created = await submitWithFile();
    await dismissCheckIn(TA_DESK, idOf(created.publicId), "Left");
    expect(objects.size).toBe(0);
    expect(rowOf(created.publicId).biodataStoragePath).toBeNull();
  });

  it("sweeps held files of check-ins expired over a day ago, and keeps newer ones", async () => {
    const old = await submitWithFile();
    vi.setSystemTime(new Date(NOW.getTime() + 2 * DAY));
    const recent = await submitWithFile(heldFile(), { firstName: "Ana", lastName: "Reyes", birthDate: "1995-01-02" });
    // 4 days + 1 minute after the first submission: it expired 1 day + 1 minute ago; the second has 1 day left.
    vi.setSystemTime(new Date(NOW.getTime() + 4 * DAY + 60 * 1000));
    await purgeExpiredBiodata();
    expect(rowOf(old.publicId).biodataStoragePath).toBeNull();
    expect(rowOf(recent.publicId).biodataStoragePath).toBeTruthy();
    expect(objects.size).toBe(1);
  });

  it("never throws from the listing when the sweep fails", async () => {
    await submitWithFile();
    vi.setSystemTime(new Date(NOW.getTime() + 5 * DAY));
    m.storage.remove.mockRejectedValueOnce(new Error("storage down"));
    await expect(purgeExpiredBiodata()).resolves.toBeUndefined();
    await expect(listPendingCheckIns()).resolves.toEqual({ items: [] });
  });

  it("removes the held file when every queue-number attempt clashes", async () => {
    m.prisma.walkInCheckIn.create.mockRejectedValue(uniqueViolation());
    await expect(submitWithFile()).rejects.toBeInstanceOf(CheckInInputError);
    expect(objects.size).toBe(0);
    expect(m.storage.remove).toHaveBeenCalledTimes(1);
  });

  it("keeps the held file when the intake fails, even if the TA attached a file of their own", async () => {
    const created = await submitWithFile();
    const path = rowOf(created.publicId).biodataStoragePath;
    m.createWalkIn.mockRejectedValueOnce(new Error("Storage upload failed"));
    await expect(confirmCheckIn(TA_DESK, idOf(created.publicId), confirmInput(), FILE)).rejects.toThrow("Storage upload failed");
    expect(rowOf(created.publicId).status).toBe("PENDING");
    expect(objects.has(path)).toBe(true);
  });

  // A failed removal after confirm keeps the path on the CONFIRMED row; the sweep picks closed rows up later.
  it("does not leave a confirmed check-in's held file behind when removing it fails", async () => {
    const created = await submitWithFile();
    m.storage.remove.mockRejectedValueOnce(new Error("storage down"));
    await confirmCheckIn(TA_DESK, idOf(created.publicId), confirmInput(), undefined);
    vi.setSystemTime(new Date(NOW.getTime() + 2 * DAY));
    await purgeExpiredBiodata();
    expect(objects.size).toBe(0);
  });

  // Same for a dismissed check-in.
  it("does not leave a dismissed check-in's held file behind when removing it fails", async () => {
    const created = await submitWithFile();
    m.storage.remove.mockRejectedValueOnce(new Error("storage down"));
    await dismissCheckIn(TA_DESK, idOf(created.publicId), "Left");
    vi.setSystemTime(new Date(NOW.getTime() + 2 * DAY));
    await purgeExpiredBiodata();
    expect(objects.size).toBe(0);
  });

  // Accepted limitation: if both the DB insert and the storage removal fail, no row points at the object, so
  // the sweep cannot find it. The object stays private and needs both systems to fail at once.
  it.fails("does not leave a file behind when the row cannot be created and removing it also fails", async () => {
    m.prisma.walkInCheckIn.create.mockRejectedValueOnce(new Error("db down"));
    m.storage.remove.mockRejectedValueOnce(new Error("storage down"));
    await expect(submitWithFile()).rejects.toThrow("db down");
    vi.setSystemTime(new Date(NOW.getTime() + 5 * DAY));
    await purgeExpiredBiodata();
    expect(objects.size).toBe(0);
  });

  describe("GET biodata handler", () => {
    it("answers 404 for a dismissed check-in even while its file is still held", async () => {
      const created = await submitWithFile();
      m.storage.remove.mockRejectedValueOnce(new Error("storage down"));
      await dismissCheckIn(TA_DESK, idOf(created.publicId), "Left");
      expect(rowOf(created.publicId).biodataStoragePath).toBeTruthy();
      const res = makeRes();
      await getCheckInBiodataHandler({ params: { id: String(idOf(created.publicId)) } } as any, res);
      expect(res.statusCode).toBe(404);
    });

    it("answers 404 for a held check-in past its three days, before any sweep runs", async () => {
      const created = await submitWithFile();
      vi.setSystemTime(new Date(NOW.getTime() + 4 * DAY));
      expect(rowOf(created.publicId).biodataStoragePath).toBeTruthy();
      const res = makeRes();
      await getCheckInBiodataHandler({ params: { id: String(idOf(created.publicId)) } } as any, res);
      expect(res.statusCode).toBe(404);
    });

    it("keeps header breaks, quotes and semicolons out of the stored name and the Content-Disposition header", async () => {
      const created = await submitWithFile(heldFile({ originalname: 'evil\r\nSet-Cookie: a=b "q"; x.pdf' }));
      expect(rowOf(created.publicId).biodataFileName).not.toMatch(/[\r\n"]/);
      const res = makeRes();
      await getCheckInBiodataHandler({ params: { id: String(idOf(created.publicId)) } } as any, res);
      const disposition = res.headers["Content-Disposition"];
      expect(disposition).not.toMatch(/[\r\n]/);
      expect(disposition).toMatch(/^inline; filename="[^"\\;\r\n]*"; filename\*=UTF-8''[A-Za-z0-9._~%!()*'-]*$/);
    });

    // Known gap: a storage download failure is a server fault (statusFor's own rule), but the message is in
    // publicMessages, so the handler answers 400 "Attach it again". Flip to `it` once statusFor maps it to 500.
    it("answers 500, not 400, when the stored file cannot be downloaded", async () => {
      const created = await submitWithFile();
      m.storage.download.mockResolvedValueOnce({ data: null, error: new Error("storage down") });
      const res = makeRes();
      await getCheckInBiodataHandler({ params: { id: String(idOf(created.publicId)) } } as any, res);
      expect(res.statusCode).toBe(500);
    });

    it("returns the file with its type, no-store and nosniff", async () => {
      const created = await submitWithFile();
      const res = makeRes();
      await getCheckInBiodataHandler({ params: { id: String(idOf(created.publicId)) } } as any, res);
      expect(res.statusCode).toBe(200);
      expect(res.headers["Content-Type"]).toBe("application/pdf");
      expect(res.headers["Cache-Control"]).toBe("no-store");
      expect(res.headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(res.headers["Content-Disposition"]).toContain('inline; filename="my biodata.pdf"');
      expect(Buffer.compare(res.body, PDF)).toBe(0);
    });

    it("answers 404 for a confirmed check-in, a check-in without a file, and an unknown id", async () => {
      const confirmed = await submitWithFile();
      await confirmCheckIn(TA_DESK, idOf(confirmed.publicId), confirmInput(), undefined);
      const bare = await submit({ firstName: "Ana", lastName: "Reyes", birthDate: "1995-01-02" });
      for (const id of [idOf(confirmed.publicId), idOf(bare.publicId), 99999]) {
        const res = makeRes();
        await getCheckInBiodataHandler({ params: { id: String(id) } } as any, res);
        expect(res.statusCode).toBe(404);
      }
    });
  });
});

describe("confirm request schema", () => {
  // The exact field set the confirm form sends (see EncodeWalkInDialog in check-in mode).
  const formFields = { firstName: "James", middleName: "Spank", lastName: "Presley", mobileNumber: "09606128851", birthDate: "2004-10-22" };

  it("accepts what the confirm form sends", () => {
    const parsed = checkInSchema.confirm.safeParse({ params: { id: "2" }, body: formFields });
    expect(parsed.success).toBe(true);
  });

  it("rejects a job id: the check-in already names its job", () => {
    const parsed = checkInSchema.confirm.safeParse({ params: { id: "2" }, body: { ...formFields, jobPostingId: "10" } });
    expect(parsed.success).toBe(false);
  });
});

