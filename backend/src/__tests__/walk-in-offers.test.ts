import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";

// Offer replies without the portal. The database, SMS gateway, notifications and audit are mocked.
// The ownership rules are real: a TA is checked against the job's requisition through jobPosting.count.
const m = vi.hoisted(() => {
  const fn = () => vi.fn();
  const prisma: Record<string, any> = {
    talentPoolInvitation: { findUnique: fn(), update: fn(), updateMany: fn() },
    jobPosting: { count: fn() },
    application: { aggregate: fn(), create: fn(), update: fn() },
    recruiterDecision: { create: fn() },
    talentPoolContact: { create: fn() },
    talentPoolMembership: { update: fn() },
    deployment: { findFirst: fn(), findMany: fn() },
    $transaction: fn(),
  };
  return {
    prisma,
    sendSmsViaTextBee: fn(),
    sendNotification: fn(),
    logAudit: fn(),
    calculateAndPersistCandidateScore: fn(),
  };
});

vi.mock("../utils/prisma.js", () => ({ default: m.prisma }));
vi.mock("../utils/sms.js", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  sendSmsViaTextBee: m.sendSmsViaTextBee,
}));
vi.mock("../utils/notification.js", () => ({ notifyJobOwner: vi.fn(async () => 0), notifyOwner: vi.fn(async () => 0), sendNotification: m.sendNotification }));
vi.mock("../utils/audit.js", () => ({ logAudit: m.logAudit }));
vi.mock("../services/scoring/candidate-scoring.service.js", () => ({
  calculateAndPersistCandidateScore: m.calculateAndPersistCandidateScore,
}));
vi.mock("../services/scoring/talent-pool-knn.service.js", () => ({
  InvalidKnnRequestError: class InvalidKnnRequestError extends Error {},
}));
// The invitation service imports walk-in.service for tracking codes. Keep its storage, upload, queue and
// scoring dependencies out of this unit test, so no real Supabase client or worker starts.
vi.mock("../utils/supabase.js", () => ({ default: { auth: { admin: {} }, storage: {} } }));
vi.mock("../middleware/upload.middleware.js", () => ({ uploadFileToSupabaseWithInfo: vi.fn() }));
vi.mock("../workers/resume.worker.js", () => ({ enqueueResumeAnalysis: vi.fn(), trackFitRevalidation: vi.fn() }));
vi.mock("../services/scoring/scoring-configuration.service.js", () => ({ revalidateApplication: vi.fn() }));
vi.mock("../services/applicant/application.service.js", () => ({ assertCanApply: vi.fn(), resolveInitialStatus: vi.fn() }));

import {
  getOfferByToken,
  recordAssistedResponse,
  respondToJobInvitation,
  respondViaOfferLink,
  sendOfferSmsLink,
} from "../services/ta/talent-pool-invitation.service.js";

const TOKEN = "Lq8vR2mZ_tK4wXnP0aBcDe";
const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

const freshInvitation = () => ({
  id: 9,
  applicantProfileId: 3,
  membershipId: null as number | null,
  jobPostingId: 5,
  invitedById: "ta-1",
  status: "PENDING",
  message: "Report to the Cebu office on Monday",
  declineReason: null as string | null,
  responseNotes: null as string | null,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) as Date | null,
  respondedAt: null as Date | null,
  responseChannel: "PORTAL",
  assistedById: null as string | null,
  responseTokenHash: null as string | null,
  applicantProfile: {
    id: 3,
    userId: "user-1",
    firstName: "Juan",
    lastName: "Dela Cruz",
    resumeUrl: "https://files.example/resume.pdf",
    mobileNumber: "09171234567" as string | null,
    user: { phoneNumber: "+639171234567" as string | null },
  },
  jobPosting: {
    id: 5,
    title: "Forklift Operator",
    location: "Cebu City",
    status: "OPEN",
    mrf: { clientId: 2, client: { name: "Acme Logistics" } },
  },
});

// A single invitation row and its applications, behind mocks that behave like the database for these calls.
let inv: any;
let applications: any[];

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.APP_URL;
  delete process.env.FRONTEND_URL;

  inv = freshInvitation();
  applications = [];

  m.prisma.$transaction.mockImplementation(async (fn: any) => fn(m.prisma));
  m.prisma.talentPoolInvitation.findUnique.mockImplementation(async ({ where }: any) =>
    inv && inv.id === where.id ? structuredClone(inv) : null
  );
  m.prisma.talentPoolInvitation.update.mockImplementation(async ({ where, data }: any) => {
    if (!inv || inv.id !== where.id) throw new Error("Record to update not found.");
    Object.assign(inv, data);
    return structuredClone(inv);
  });
  // Conditional claim, as the service does it: only a row that is still PENDING can be changed.
  m.prisma.talentPoolInvitation.updateMany.mockImplementation(async ({ where, data }: any) => {
    const matches = !!inv && inv.id === where.id && (where.status === undefined || inv.status === where.status);
    if (!matches) return { count: 0 };
    Object.assign(inv, data);
    return { count: 1 };
  });
  m.prisma.application.update.mockImplementation(async ({ where, data }: any) => {
    const row = applications.find((a) => a.id === where.id);
    if (!row) throw new Error("Record to update not found.");
    Object.assign(row, data);
    return structuredClone(row);
  });
  m.prisma.jobPosting.count.mockResolvedValue(1);
  m.prisma.application.aggregate.mockResolvedValue({ _max: { attemptNumber: 0 } });
  m.prisma.application.create.mockImplementation(async ({ data }: any) => {
    const row = { id: 100 + applications.length, ...data };
    applications.push(row);
    return structuredClone(row);
  });
  m.prisma.recruiterDecision.create.mockResolvedValue({});
  m.prisma.talentPoolContact.create.mockResolvedValue({});
  m.prisma.talentPoolMembership.update.mockResolvedValue({});
  m.prisma.deployment.findFirst.mockResolvedValue(null);
  m.prisma.deployment.findMany.mockResolvedValue([]);
  m.sendSmsViaTextBee.mockResolvedValue({ success: true, smsBatchId: "b-1" });
  m.sendNotification.mockResolvedValue(undefined);
  m.logAudit.mockResolvedValue(undefined);
  m.calculateAndPersistCandidateScore.mockResolvedValue(undefined);
});

describe("respondToJobInvitation: who may answer", () => {
  it("lets the applicant accept with their own login, recorded as a portal reply", async () => {
    const result = await respondToJobInvitation({
      actor: { kind: "APPLICANT", userId: "user-1" },
      invitationId: 9,
      decision: "ACCEPT",
    });
    expect(result.success).toBe(true);
    expect(inv.status).toBe("ACCEPTED");
    expect(inv.responseChannel).toBe("PORTAL");
    expect(inv.assistedById).toBeNull();
    expect(applications).toHaveLength(1);
    expect(applications[0]).toMatchObject({ userId: "user-1", jobPostingId: 5, status: "SUBMITTED" });
  });

  it("refuses an applicant who answers with someone else's login", async () => {
    await expect(
      respondToJobInvitation({ actor: { kind: "APPLICANT", userId: "user-2" }, invitationId: 9, decision: "ACCEPT" })
    ).rejects.toThrow("Unauthorized to respond to this invitation.");
    expect(inv.status).toBe("PENDING");
    expect(applications).toHaveLength(0);
  });

  it("lets a TA record a phone answer without the applicant's login and keeps the TA as the assistant", async () => {
    await respondToJobInvitation({
      actor: { kind: "ASSISTED", taId: "ta-1", channel: "ASSISTED_PHONE" },
      invitationId: 9,
      decision: "DECLINE",
      declineReason: "LOCATION_COMMUTE",
    });
    expect(inv.status).toBe("DECLINED");
    expect(inv.declineReason).toBe("LOCATION_COMMUTE");
    expect(inv.responseChannel).toBe("ASSISTED_PHONE");
    expect(inv.assistedById).toBe("ta-1");
  });

  it("records an in-person answer with the channel set to IN_PERSON", async () => {
    await respondToJobInvitation({
      actor: { kind: "ASSISTED", taId: "ta-1", channel: "IN_PERSON" },
      invitationId: 9,
      decision: "ACCEPT",
    });
    expect(inv.responseChannel).toBe("IN_PERSON");
    expect(inv.assistedById).toBe("ta-1");
    expect(inv.status).toBe("ACCEPTED");
  });

  it("marks a texted-link answer as SMS_MAGIC_LINK with no assistant", async () => {
    await respondToJobInvitation({
      actor: { kind: "MAGIC_LINK" },
      invitationId: 9,
      decision: "DECLINE",
      declineReason: "NOT_INTERESTED",
    });
    expect(inv.responseChannel).toBe("SMS_MAGIC_LINK");
    expect(inv.assistedById).toBeNull();
  });

  it.each([
    ["applicant accept", { kind: "APPLICANT", userId: "user-1" }, "ACCEPT"],
    ["assisted accept", { kind: "ASSISTED", taId: "ta-1", channel: "ASSISTED_PHONE" }, "ACCEPT"],
    ["assisted decline", { kind: "ASSISTED", taId: "ta-1", channel: "IN_PERSON" }, "DECLINE"],
    ["link accept", { kind: "MAGIC_LINK" }, "ACCEPT"],
    ["link decline", { kind: "MAGIC_LINK" }, "DECLINE"],
  ])("clears the link token after a %s", async (_label, actor, decision) => {
    inv.responseTokenHash = sha256(TOKEN);
    await respondToJobInvitation({
      actor: actor as any,
      invitationId: 9,
      decision: decision as "ACCEPT" | "DECLINE",
      declineReason: decision === "DECLINE" ? "NOT_INTERESTED" : undefined,
    });
    expect(inv.status).not.toBe("PENDING");
    expect(inv.responseTokenHash).toBeNull();
  });

  it("audits an assisted reply under the TA, with the channel", async () => {
    await respondToJobInvitation({
      actor: { kind: "ASSISTED", taId: "ta-1", channel: "IN_PERSON" },
      invitationId: 9,
      decision: "ACCEPT",
    });
    expect(m.logAudit).toHaveBeenCalledWith(
      "ta-1",
      "TALENT_POOL_INVITATION_ACCEPTED",
      "Application",
      100,
      expect.objectContaining({ channel: "IN_PERSON", invitationId: 9 })
    );
  });

  it("audits an applicant's own reply under the applicant, with the channel", async () => {
    await respondToJobInvitation({ actor: { kind: "APPLICANT", userId: "user-1" }, invitationId: 9, decision: "ACCEPT" });
    expect(m.logAudit).toHaveBeenCalledWith(
      "user-1",
      "TALENT_POOL_INVITATION_ACCEPTED",
      "Application",
      100,
      expect.objectContaining({ channel: "PORTAL" })
    );
  });

  it("refuses a reply once the invitation has already been answered", async () => {
    inv.status = "DECLINED";
    await expect(
      respondToJobInvitation({ actor: { kind: "MAGIC_LINK" }, invitationId: 9, decision: "ACCEPT" })
    ).rejects.toThrow(/no longer pending/);
    expect(applications).toHaveLength(0);
  });

  it("expires an invitation whose date has passed and refuses the reply", async () => {
    inv.expiresAt = new Date(Date.now() - 1000);
    await expect(
      respondToJobInvitation({ actor: { kind: "APPLICANT", userId: "user-1" }, invitationId: 9, decision: "ACCEPT" })
    ).rejects.toThrow("This job invitation has expired.");
    expect(inv.status).toBe("EXPIRED");
    expect(applications).toHaveLength(0);
  });
});

describe("recordAssistedResponse: a TA records a phone or in-person answer", () => {
  it("refuses a job the TA does not own, as not found, and changes nothing", async () => {
    m.prisma.jobPosting.count.mockResolvedValue(0);
    const error = await recordAssistedResponse({
      invitationId: 9,
      taId: "ta-2",
      decision: "ACCEPT",
      channel: "ASSISTED_PHONE",
    }).catch((e) => e);
    expect(error).toMatchObject({ message: "Invitation not found", status: 404 });
    expect(inv.status).toBe("PENDING");
    expect(applications).toHaveLength(0);
  });

  it("records an accept given by phone and returns the new application id", async () => {
    const result = await recordAssistedResponse({ invitationId: 9, taId: "ta-1", decision: "ACCEPT", channel: "ASSISTED_PHONE" });
    expect(result).toEqual({ status: "ACCEPTED", applicationId: 100 });
    expect(inv.responseChannel).toBe("ASSISTED_PHONE");
    expect(inv.assistedById).toBe("ta-1");
  });

  it("records a decline given in person with its reason and notes, and creates no application", async () => {
    const result = await recordAssistedResponse({
      invitationId: 9,
      taId: "ta-1",
      decision: "DECLINE",
      channel: "IN_PERSON",
      declineReason: "SALARY_MISMATCH",
      notes: "wants a higher rate",
    });
    expect(result).toEqual({ status: "DECLINED" });
    expect(inv.declineReason).toBe("SALARY_MISMATCH");
    expect(inv.responseNotes).toBe("wants a higher rate");
    expect(applications).toHaveLength(0);
  });

  it("answers not found for an unknown invitation", async () => {
    await expect(
      recordAssistedResponse({ invitationId: 77, taId: "ta-1", decision: "ACCEPT", channel: "IN_PERSON" })
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("sendOfferSmsLink: a texted one-time link", () => {
  const lastSmsText = (): string => m.sendSmsViaTextBee.mock.calls.at(-1)![1] as string;
  const lastToken = (): string => /token=([A-Za-z0-9_-]+)/.exec(lastSmsText())![1];

  it("texts the link to the applicant's number and stores only a hash of the token", async () => {
    const result = await sendOfferSmsLink({ invitationId: 9, taId: "ta-1" });

    expect(result.sentTo).toMatch(/^0917\*+/);
    expect(result.expiresAt).toBe(inv.expiresAt.toISOString());

    const [to, text] = m.sendSmsViaTextBee.mock.calls[0];
    expect(to).toBe("+639171234567");
    expect(text).toContain("You have a job offer for Forklift Operator.");
    const token = lastToken();
    expect(text).toContain(`http://localhost:5173/offer/9?token=${token}`);
    expect(inv.responseTokenHash).toBe(sha256(token));
    expect(inv.responseTokenHash).not.toContain(token);
  });

  it("falls back to the mobile number on the profile when the account has no phone", async () => {
    inv.applicantProfile.user.phoneNumber = null;
    await sendOfferSmsLink({ invitationId: 9, taId: "ta-1" });
    expect(m.sendSmsViaTextBee.mock.calls[0][0]).toBe("09171234567");
  });

  it("refuses an applicant with no mobile number on file and sends nothing", async () => {
    inv.applicantProfile.mobileNumber = null;
    inv.applicantProfile.user.phoneNumber = null;
    await expect(sendOfferSmsLink({ invitationId: 9, taId: "ta-1" })).rejects.toMatchObject({ status: 409 });
    expect(m.sendSmsViaTextBee).not.toHaveBeenCalled();
    expect(inv.responseTokenHash).toBeNull();
  });

  it("refuses an invitation that is no longer pending", async () => {
    inv.status = "ACCEPTED";
    await expect(sendOfferSmsLink({ invitationId: 9, taId: "ta-1" })).rejects.toMatchObject({ status: 409 });
    expect(m.sendSmsViaTextBee).not.toHaveBeenCalled();
  });

  it("keeps no usable link when the text cannot be sent, and reports 502", async () => {
    m.sendSmsViaTextBee.mockResolvedValueOnce({ success: false, error: "gateway down" });
    await expect(sendOfferSmsLink({ invitationId: 9, taId: "ta-1" })).rejects.toMatchObject({ status: 502 });
    expect(inv.responseTokenHash).toBeNull();
  });

  it("keeps the previous link working when a resend fails", async () => {
    await sendOfferSmsLink({ invitationId: 9, taId: "ta-1" });
    const previous = lastToken();

    m.sendSmsViaTextBee.mockResolvedValueOnce({ success: false, error: "gateway down" });
    await expect(sendOfferSmsLink({ invitationId: 9, taId: "ta-1" })).rejects.toMatchObject({ status: 502 });

    expect(inv.responseTokenHash).toBe(sha256(previous));
    await expect(getOfferByToken(9, previous)).resolves.toMatchObject({ invitationId: 9 });
  });

  it("makes an earlier texted link stop working once a new one is sent", async () => {
    await sendOfferSmsLink({ invitationId: 9, taId: "ta-1" });
    const first = lastToken();
    await sendOfferSmsLink({ invitationId: 9, taId: "ta-1" });
    const second = lastToken();

    expect(second).not.toBe(first);
    await expect(getOfferByToken(9, first)).rejects.toThrow("Not found");
    await expect(getOfferByToken(9, second)).resolves.toMatchObject({ invitationId: 9 });
  });

  it("refuses a TA who does not own the job, and sends nothing", async () => {
    m.prisma.jobPosting.count.mockResolvedValue(0);
    await expect(sendOfferSmsLink({ invitationId: 9, taId: "ta-2" })).rejects.toMatchObject({ status: 404 });
    expect(m.sendSmsViaTextBee).not.toHaveBeenCalled();
  });
});

describe("getOfferByToken: the public offer page", () => {
  beforeEach(() => {
    inv.responseTokenHash = sha256(TOKEN);
  });

  it("shows the offer with the applicant's first name only and no contact details", async () => {
    const offer = await getOfferByToken(9, TOKEN);
    expect(Object.keys(offer).sort()).toEqual([
      "applicantFirstName",
      "clientName",
      "expiresAt",
      "invitationId",
      "jobTitle",
      "location",
      "message",
      "status",
    ]);
    expect(offer).toMatchObject({
      invitationId: 9,
      status: "PENDING",
      applicantFirstName: "Juan",
      jobTitle: "Forklift Operator",
      clientName: "Acme Logistics",
      location: "Cebu City",
      message: "Report to the Cebu office on Monday",
    });
    expect(JSON.stringify(offer)).not.toMatch(/09171234567|639171234567|Dela Cruz/);
  });

  it("refuses a wrong token, a missing token, and a token used on another invitation", async () => {
    await expect(getOfferByToken(9, "Wrong_token_value_1")).rejects.toThrow("Not found");
    await expect(getOfferByToken(9, "")).rejects.toThrow("Not found");
    await expect(getOfferByToken(10, TOKEN)).rejects.toThrow("Not found");
  });

  it("refuses an expired link", async () => {
    inv.expiresAt = new Date(Date.now() - 1000);
    await expect(getOfferByToken(9, TOKEN)).rejects.toThrow("Not found");
  });

  it("refuses a link once the invitation has been answered", async () => {
    inv.status = "ACCEPTED";
    await expect(getOfferByToken(9, TOKEN)).rejects.toThrow("Not found");
  });
});

describe("respondViaOfferLink: the link works once", () => {
  beforeEach(() => {
    inv.responseTokenHash = sha256(TOKEN);
  });

  it("refuses a wrong token and changes nothing", async () => {
    await expect(respondViaOfferLink(9, "Wrong_token_value_1", "ACCEPT")).rejects.toThrow("Not found");
    expect(inv.status).toBe("PENDING");
    expect(inv.responseTokenHash).toBe(sha256(TOKEN));
    expect(applications).toHaveLength(0);
  });

  it("accepts with the right token, records a texted-link reply, and clears the link", async () => {
    const result = await respondViaOfferLink(9, TOKEN, "ACCEPT");
    expect(result).toEqual({ status: "ACCEPTED", applicationId: 100 });
    expect(inv.responseChannel).toBe("SMS_MAGIC_LINK");
    expect(inv.responseTokenHash).toBeNull();
    expect(applications[0]).toMatchObject({ userId: "user-1" });
  });

  it("declines through the link with the reason given", async () => {
    const result = await respondViaOfferLink(9, TOKEN, "DECLINE", "SALARY_MISMATCH");
    expect(result).toEqual({ status: "DECLINED" });
    expect(inv.declineReason).toBe("SALARY_MISMATCH");
    expect(inv.responseChannel).toBe("SMS_MAGIC_LINK");
  });

  it("refuses the same link a second time and creates no second application", async () => {
    await respondViaOfferLink(9, TOKEN, "ACCEPT");
    await expect(respondViaOfferLink(9, TOKEN, "ACCEPT")).rejects.toThrow("Not found");
    await expect(respondViaOfferLink(9, TOKEN, "DECLINE")).rejects.toThrow("Not found");
    expect(applications).toHaveLength(1);
  });

  it("refuses a link after the invitation was answered in person", async () => {
    await recordAssistedResponse({ invitationId: 9, taId: "ta-1", decision: "DECLINE", channel: "IN_PERSON" });
    await expect(respondViaOfferLink(9, TOKEN, "ACCEPT")).rejects.toThrow("Not found");
    expect(applications).toHaveLength(0);
  });

  it("refuses a link after it has expired", async () => {
    inv.expiresAt = new Date(Date.now() - 1000);
    await expect(respondViaOfferLink(9, TOKEN, "ACCEPT")).rejects.toThrow("Not found");
    expect(applications).toHaveLength(0);
  });

  // Both taps read PENDING before either writes. The conditional claim (status PENDING) lets only one through.
  it("accepts a link only once even when two taps arrive together", async () => {
    const results = await Promise.allSettled([
      respondViaOfferLink(9, TOKEN, "ACCEPT"),
      respondViaOfferLink(9, TOKEN, "ACCEPT"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(applications).toHaveLength(1);
  });

  it("lets only one of an accept and a decline arriving together count", async () => {
    const results = await Promise.allSettled([
      respondViaOfferLink(9, TOKEN, "ACCEPT"),
      respondViaOfferLink(9, TOKEN, "DECLINE", "NOT_INTERESTED"),
    ]);
    const fulfilled = results.filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);
    expect(inv.status).toBe(fulfilled[0].value.status);
    expect(applications).toHaveLength(fulfilled[0].value.status === "ACCEPTED" ? 1 : 0);
  });
});

describe("an offer accepted by a walk-in keeps a walk-in application", () => {
  beforeEach(() => {
    inv.responseTokenHash = sha256(TOKEN);
  });

  it("creates the application as WALK_IN with a tracking code and a token hash", async () => {
    inv.applicantProfile.user.accountStatus = "WALK_IN";

    const result = await respondViaOfferLink(9, TOKEN, "ACCEPT");

    expect(result).toEqual({ status: "ACCEPTED", applicationId: 100 });
    expect(m.prisma.application.create.mock.calls[0][0].data).toMatchObject({ source: "WALK_IN", userId: "user-1" });
    expect(applications[0]).toMatchObject({ source: "WALK_IN", trackingCode: `WLK-${new Date().getFullYear()}-0100` });
    expect(applications[0].trackingTokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("leaves an ONLINE applicant's application ONLINE, with no tracking code", async () => {
    inv.applicantProfile.user.accountStatus = "ACTIVE";

    await respondViaOfferLink(9, TOKEN, "ACCEPT");

    expect(m.prisma.application.create.mock.calls[0][0].data).not.toHaveProperty("source");
    expect(m.prisma.application.update).not.toHaveBeenCalled();
    expect(applications[0].trackingCode).toBeUndefined();
  });
});
