import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx: any = {};
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]), update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    deleteMany: vi.fn(), delete: vi.fn(), create: vi.fn(), findUniqueOrThrow: vi.fn(),
  });
  for (const k of [
    "user", "application", "savedJob", "storedDocument", "notification", "notificationOutbox", "auditLog", "employee",
    "workExperience", "education", "trainingCertification", "characterReference", "applicantSkill", "resumeParseResult",
    "talentPoolInvitation", "asset", "recruiterDecision", "talentPoolMembership", "scoringRevalidationTask", "candidateFeatureProfile", "applicantProfile",
  ]) tx[k] = model();
  return { tx };
});
vi.mock("../../src/utils/prisma.js", () => ({ default: { $transaction: (fn: any) => fn(mocks.tx), user: { findMany: vi.fn() } } }));

import { mergeApplicantAccounts, pickSurvivor, MergeSkipped, type MergeMember } from "../../src/services/ta/applicant-merge.service.js";

const member = (o: Partial<MergeMember>): MergeMember => ({
  userId: "u", profileId: 1, accountStatus: "ACTIVE", syntheticEmail: false, verified: false, applications: 0,
  hasEmployee: false, createdAt: new Date("2026-10-01"), firstName: "A", lastName: "B", mobile10: "9171234567", ...o,
});

const userRow = (id: string, extra: any = {}) => ({
  id, role: "APPLICANT", phoneNumber: null, employee: null,
  email: id === "s" ? "real@example.com" : "639171234567@applicant.megs.local",
  applicantProfile: {
    id: id === "s" ? 1 : 2, verificationStatus: "UNVERIFIED", workExperiences: [], educations: [], skills: [],
    trainings: [], characterReferences: [], talentPoolMembership: null, hasNoShowHistory: false, middleName: null, city: id === "s" ? null : "Makati", ...extra,
  },
});

describe("pickSurvivor", () => {
  it("prefers the real-email active account over a walk-in with more applications", () => {
    const real = member({ userId: "real", applications: 1 });
    const walkIn = member({ userId: "walk", accountStatus: "WALK_IN", syntheticEmail: true, applications: 5 });
    expect(pickSurvivor([walkIn, real]).survivor.userId).toBe("real");
  });
  it("then most applications, then oldest", () => {
    const a = member({ userId: "a", applications: 2 });
    const b = member({ userId: "b", applications: 3 });
    const c = member({ userId: "c", applications: 3, createdAt: new Date("2026-09-01") });
    expect(pickSurvivor([a, b, c]).survivor.userId).toBe("c");
  });
});

describe("mergeApplicantAccounts", () => {
  it("skips when both accounts have an employee record", async () => {
    mocks.tx.user.findUniqueOrThrow
      .mockResolvedValueOnce({ ...userRow("s"), employee: { id: 1 } })
      .mockResolvedValueOnce({ ...userRow("l"), employee: { id: 2 } });
    await expect(mergeApplicantAccounts("s", "l")).rejects.toBeInstanceOf(MergeSkipped);
    expect(mocks.tx.user.delete).not.toHaveBeenCalled();
  });

  it("never removes an account that has its own real-email login", async () => {
    mocks.tx.user.findUniqueOrThrow
      .mockResolvedValueOnce(userRow("s"))
      .mockResolvedValueOnce({ ...userRow("l"), email: "other@example.com" });
    await expect(mergeApplicantAccounts("s", "l")).rejects.toThrow(/real-email login/);
    expect(mocks.tx.user.delete).not.toHaveBeenCalled();
  });

  it("renumbers a clashing attempt, fills empty fields, and deletes the loser", async () => {
    mocks.tx.user.findUniqueOrThrow.mockResolvedValueOnce(userRow("s")).mockResolvedValueOnce(userRow("l"));
    mocks.tx.application.findMany
      .mockResolvedValueOnce([{ jobPostingId: 7, attemptNumber: 2 }])
      .mockResolvedValueOnce([{ id: 99, jobPostingId: 7, attemptNumber: 1 }]);
    const counts = await mergeApplicantAccounts("s", "l");
    expect(mocks.tx.application.update).toHaveBeenCalledWith({ where: { id: 99 }, data: { userId: "s", attemptNumber: 3 } });
    expect(mocks.tx.applicantProfile.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { city: "Makati" } });
    expect(mocks.tx.applicantProfile.delete).toHaveBeenCalledWith({ where: { id: 2 } });
    expect(mocks.tx.user.delete).toHaveBeenCalledWith({ where: { id: "l" } });
    expect(mocks.tx.recruiterDecision.updateMany).toHaveBeenCalledWith({ where: { actorId: "l" }, data: { actorId: "s" } });
    expect(mocks.tx.storedDocument.updateMany).toHaveBeenCalledWith({ where: { ownerId: "l" }, data: { ownerId: "s" } });
    expect(counts.applications).toBe(1);
  });
});
