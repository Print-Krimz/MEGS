import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

const db = { users: {} as Record<string, any> };
const mocks = vi.hoisted(() => ({
  sms: vi.fn(),
  userFindUnique: vi.fn(),
  notificationUpdate: vi.fn(),
  notificationFindFirst: vi.fn(),
  notificationFindMany: vi.fn(),
}));

vi.mock("../../src/utils/prisma.js", () => ({
  default: {
    user: { findUnique: mocks.userFindUnique },
    notification: {
      update: mocks.notificationUpdate,
      findFirst: mocks.notificationFindFirst,
      findMany: mocks.notificationFindMany,
    },
  },
}));
vi.mock("../../src/utils/sms.js", async (orig) => ({ ...(await orig<any>()), sendSmsViaTextBee: mocks.sms }));
vi.mock("../../src/utils/mailer.js", () => ({ sendMail: vi.fn(), buildNotificationEmailHtml: vi.fn(() => "") }));

import { dispatchNotificationSms, formatSms, isSmsQuietHours } from "../../src/utils/notification.js";
import { sendSmsOutbox } from "../../src/workers/sms-outbox.js";
import { smsFor } from "../../src/workers/reminders/rules.js";

const DAYTIME = new Date("2026-10-29T04:00:00Z"); // 12:00 Manila
const QUIET = new Date("2026-10-29T15:00:00Z"); // 23:00 Manila
const DEDUPE_WINDOW_START = new Date(DAYTIME.getTime() - 10 * 60_000);
const DAY_MS = 24 * 60 * 60_000;

type Fixture = { email: string; phoneNumber: string | null; mobileNumber: string | null };

const REAL_EMAIL_PH: Fixture = { email: "maria@example.com", phoneNumber: "09171234567", mobileNumber: null };
const SYNTHETIC_PH: Fixture = { email: "639171234567@applicant.megs.local", phoneNumber: "+639171234567", mobileNumber: null };
const SYNTHETIC_NO_PHONE: Fixture = { email: "639170000001@applicant.megs.local", phoneNumber: null, mobileNumber: null };

const setUser = (id: string, fixture: Fixture) => {
  db.users[id] = { id, ...fixture, applicantProfile: { mobileNumber: fixture.mobileNumber } };
};

let consoleError: MockInstance;

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(DAYTIME);
  process.env.SMS_NOTIFICATIONS_ENABLED = "true";
  db.users = {};
  mocks.userFindUnique.mockImplementation(async ({ where }: any) => db.users[where.id] ?? null);
  mocks.notificationFindFirst.mockResolvedValue(null);
  mocks.notificationFindMany.mockResolvedValue([]);
  mocks.notificationUpdate.mockResolvedValue({});
  mocks.sms.mockResolvedValue({ success: true, smsBatchId: "batch-1" });
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.SMS_NOTIFICATIONS_ENABLED;
  vi.restoreAllMocks();
});

describe("dispatchNotificationSms", () => {
  it.each([undefined, "false", "1", "TRUE"])(
    "does nothing when SMS_NOTIFICATIONS_ENABLED is %s",
    async (value) => {
      if (value === undefined) delete process.env.SMS_NOTIFICATIONS_ENABLED;
      else process.env.SMS_NOTIFICATIONS_ENABLED = value;
      setUser("u1", SYNTHETIC_PH);

      await dispatchNotificationSms(1, "u1", { text: "Hi", always: true });

      expect(mocks.userFindUnique).not.toHaveBeenCalled();
      expect(mocks.notificationFindFirst).not.toHaveBeenCalled();
      expect(mocks.notificationUpdate).not.toHaveBeenCalled();
      expect(mocks.sms).not.toHaveBeenCalled();
    }
  );

  it("skips a user with a real email unless always is set", async () => {
    setUser("u1", REAL_EMAIL_PH);

    await dispatchNotificationSms(1, "u1", { text: "Hi" });

    expect(mocks.userFindUnique).toHaveBeenCalledTimes(1);
    expect(mocks.userFindUnique).toHaveBeenCalledWith({ where: { id: "u1" }, select: { email: true } });
    expect(mocks.notificationUpdate).not.toHaveBeenCalled();
    expect(mocks.sms).not.toHaveBeenCalled();
  });

  it("sends to a real-email user when always is set", async () => {
    setUser("u1", REAL_EMAIL_PH);

    await dispatchNotificationSms(1, "u1", { text: "Hi", always: true });

    expect(mocks.sms).toHaveBeenCalledWith("09171234567", "MEGS: Hi");
    expect(mocks.notificationUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ smsStatus: "SENT" }),
    });
  });

  it.each(["639170000001@applicant.megs.local", "walkin-1@megs.internal"])(
    "records NO_PHONE for a synthetic-email user (%s) with no valid phone",
    async (email) => {
      setUser("u2", { email, phoneNumber: null, mobileNumber: null });

      await dispatchNotificationSms(2, "u2", { text: "Hi" });

      expect(mocks.notificationUpdate).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { smsStatus: "NO_PHONE", smsAt: DAYTIME },
      });
      expect(mocks.notificationFindFirst).not.toHaveBeenCalled();
      expect(mocks.sms).not.toHaveBeenCalled();
    }
  );

  it("records NO_PHONE when every stored number is not a Philippine mobile", async () => {
    setUser("u2", { email: "639170000001@applicant.megs.local", phoneNumber: "1234567", mobileNumber: "+1 555 010 0100" });

    await dispatchNotificationSms(2, "u2", { text: "Hi" });

    expect(mocks.notificationUpdate).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { smsStatus: "NO_PHONE", smsAt: DAYTIME },
    });
    expect(mocks.sms).not.toHaveBeenCalled();
  });

  it("falls back to the applicant profile mobile when the account phone is not a PH mobile", async () => {
    setUser("u3", { email: "639170000003@applicant.megs.local", phoneNumber: "+1 555 010 0100", mobileNumber: "0917 123 4567" });

    await dispatchNotificationSms(3, "u3", { text: "Hi" });

    expect(mocks.sms).toHaveBeenCalledWith("0917 123 4567", "MEGS: Hi");
  });

  it("does nothing when the user does not exist", async () => {
    await dispatchNotificationSms(4, "missing", { text: "Hi", always: true });

    expect(mocks.notificationUpdate).not.toHaveBeenCalled();
    expect(mocks.sms).not.toHaveBeenCalled();
  });

  it("sends, then records SENT with the provider batch id and the MEGS-prefixed text", async () => {
    setUser("u4", SYNTHETIC_PH);
    mocks.sms.mockResolvedValue({ success: true, smsBatchId: "batch-123" });

    await dispatchNotificationSms(4, "u4", { text: "Your application is under review" });

    expect(mocks.notificationFindFirst).toHaveBeenCalledTimes(1);
    expect(mocks.sms).toHaveBeenCalledWith("+639171234567", "MEGS: Your application is under review");
    expect(mocks.notificationUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 4 },
      data: { smsStatus: "SENDING", smsText: "MEGS: Your application is under review", smsAt: DAYTIME, smsAttempts: { increment: 1 } },
    });
    expect(mocks.notificationUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 4 },
      data: { smsStatus: "SENT", smsProviderId: "batch-123", smsAt: DAYTIME },
    });
  });

  it("records FAILED and truncates the provider error to 200 characters", async () => {
    setUser("u5", SYNTHETIC_PH);
    mocks.sms.mockResolvedValue({ success: false, error: "x".repeat(300) });

    await dispatchNotificationSms(5, "u5", { text: "Hi" });

    expect(mocks.notificationUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.notificationUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 5 },
      data: { smsStatus: "SENDING", smsText: "MEGS: Hi", smsAt: DAYTIME, smsAttempts: { increment: 1 } },
    });
    expect(mocks.notificationUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 5 },
      data: { smsStatus: "FAILED", smsError: "x".repeat(200), smsAt: DAYTIME },
    });
  });

  it("records FAILED with a generic message when the provider gives no error text", async () => {
    setUser("u5", SYNTHETIC_PH);
    mocks.sms.mockResolvedValue({ success: false });

    await dispatchNotificationSms(5, "u5", { text: "Hi" });

    expect(mocks.notificationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ smsStatus: "FAILED", smsError: "SMS failed" }) })
    );
  });

  it("marks a repeat of a text sent in the last 10 minutes as DUPLICATE without sending", async () => {
    setUser("u6", SYNTHETIC_PH);
    mocks.notificationFindFirst.mockResolvedValue({ id: 3 });

    await dispatchNotificationSms(9, "u6", { text: "Your interview is today" });

    expect(mocks.notificationFindFirst).toHaveBeenCalledWith({
      where: {
        userId: "u6",
        id: { not: 9 },
        smsText: "MEGS: Your interview is today",
        smsStatus: { in: ["SENT", "QUEUED"] },
        smsAt: { gte: DEDUPE_WINDOW_START },
      },
      select: { id: true },
    });
    expect(mocks.sms).not.toHaveBeenCalled();
    expect(mocks.notificationUpdate).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { smsStatus: "DUPLICATE", smsText: "MEGS: Your interview is today", smsAt: DAYTIME },
    });
  });

  it("queues the text during quiet hours without sending", async () => {
    vi.setSystemTime(QUIET);
    setUser("u7", SYNTHETIC_PH);

    await dispatchNotificationSms(7, "u7", { text: "Hello" });

    expect(mocks.sms).not.toHaveBeenCalled();
    expect(mocks.notificationUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { smsStatus: "QUEUED", smsText: "MEGS: Hello", smsAt: QUIET },
    });
  });

  it("never throws when prisma rejects the user lookup", async () => {
    mocks.userFindUnique.mockRejectedValue(new Error("connection reset"));

    await expect(dispatchNotificationSms(1, "u1", { text: "Hi", always: true })).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "[NOTIFICATION SMS ERROR]",
      "connection reset",
      expect.objectContaining({ userId: "u1" })
    );
  });

  it("never throws when the SENT update fails, and leaves the row SENDING so it is not resent", async () => {
    setUser("u8", SYNTHETIC_PH);
    mocks.notificationUpdate.mockImplementation(async ({ data }: any) => {
      if (data.smsStatus === "SENT") throw new Error("write failed");
      return {};
    });

    await expect(dispatchNotificationSms(8, "u8", { text: "Hi" })).resolves.toBeUndefined();
    expect(mocks.sms).toHaveBeenCalledTimes(1);
    expect(mocks.notificationUpdate).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: expect.objectContaining({ smsStatus: "SENDING" }) }));
    expect(consoleError).toHaveBeenCalledWith("[NOTIFICATION SMS ERROR]", "write failed", expect.any(Object));
  });

  it("does not send when the row cannot be claimed", async () => {
    setUser("u8", SYNTHETIC_PH);
    mocks.notificationUpdate.mockRejectedValue(new Error("write failed"));

    await expect(dispatchNotificationSms(8, "u8", { text: "Hi" })).resolves.toBeUndefined();
    expect(mocks.sms).not.toHaveBeenCalled();
  });
});

describe("isSmsQuietHours", () => {
  it.each([
    ["2026-10-29T12:59:00Z", "20:59", false],
    ["2026-10-29T13:00:00Z", "21:00", true],
    ["2026-10-29T22:59:00Z", "06:59", true],
    ["2026-10-29T23:00:00Z", "07:00", false],
    ["2026-10-29T04:00:00Z", "12:00", false],
  ])("is quiet at %s (%s Manila) => %s", (iso, _manila, expected) => {
    expect(isSmsQuietHours(new Date(iso))).toBe(expected);
  });
});

describe("sendSmsOutbox", () => {
  it("returns zeros and touches nothing when SMS is disabled", async () => {
    delete process.env.SMS_NOTIFICATIONS_ENABLED;

    await expect(sendSmsOutbox(DAYTIME)).resolves.toEqual({ scannedCount: 0, sentCount: 0, failedCount: 0, noPhoneCount: 0 });
    expect(mocks.notificationFindMany).not.toHaveBeenCalled();
    expect(mocks.sms).not.toHaveBeenCalled();
  });

  it("returns zeros and touches nothing during quiet hours", async () => {
    await expect(sendSmsOutbox(QUIET)).resolves.toEqual({ scannedCount: 0, sentCount: 0, failedCount: 0, noPhoneCount: 0 });
    expect(mocks.notificationFindMany).not.toHaveBeenCalled();
    expect(mocks.sms).not.toHaveBeenCalled();
  });

  it("sends queued rows, records failures and NO_PHONE, and keeps going after a row throws", async () => {
    setUser("u1", SYNTHETIC_PH);
    setUser("u2", SYNTHETIC_PH);
    setUser("u3", SYNTHETIC_NO_PHONE);
    setUser("u4", SYNTHETIC_PH);
    setUser("u5", SYNTHETIC_PH);
    mocks.notificationFindMany.mockResolvedValue([
      { id: 1, userId: "u1", smsText: "MEGS: one" },
      { id: 2, userId: "u2", smsText: "MEGS: two" },
      { id: 3, userId: "u3", smsText: "MEGS: three" },
      { id: 4, userId: "u4", smsText: "MEGS: four" },
      { id: 5, userId: "u5", smsText: "MEGS: five" },
    ]);
    mocks.sms
      .mockResolvedValueOnce({ success: true, smsBatchId: "b1" }) // row 1
      .mockResolvedValueOnce({ success: false, error: "gateway down" }) // row 2
      .mockResolvedValueOnce({ success: true, smsBatchId: "b4" }) // row 4, its SENT update throws
      .mockResolvedValueOnce({ success: true, smsBatchId: "b5" }); // row 5
    mocks.notificationUpdate.mockImplementation(async ({ where, data }: any) => {
      if (where.id === 4 && data.smsStatus === "SENT") throw new Error("db write failed");
      return {};
    });

    const result = await sendSmsOutbox(DAYTIME);

    expect(result).toEqual({ scannedCount: 5, sentCount: 2, failedCount: 2, noPhoneCount: 1 });
    expect(mocks.notificationFindMany).toHaveBeenCalledWith({
      where: {
        smsStatus: { in: ["QUEUED", "FAILED"] },
        smsAttempts: { lt: 2 },
        smsText: { not: null },
        createdAt: { gte: new Date(DAYTIME.getTime() - DAY_MS) },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: { id: true, userId: true, smsText: true },
    });
    expect(mocks.sms).toHaveBeenCalledTimes(4);
    expect(mocks.sms).toHaveBeenNthCalledWith(1, "+639171234567", "MEGS: one");
    expect(mocks.notificationUpdate).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { smsStatus: "NO_PHONE", smsAt: DAYTIME },
    });
    expect(mocks.notificationUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { smsStatus: "SENDING", smsText: "MEGS: one", smsAt: DAYTIME, smsAttempts: { increment: 1 } },
    });
    expect(mocks.notificationUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { smsStatus: "SENT", smsProviderId: "b1", smsAt: DAYTIME },
    });
    expect(mocks.notificationUpdate).toHaveBeenCalledWith({
      where: { id: 2 },
      data: expect.objectContaining({ smsStatus: "FAILED", smsError: "gateway down" }),
    });
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("sms outbox notification 4"));
  });
});

describe("formatSms", () => {
  it("turns curly quotes, dashes, ellipses and accents into ASCII", () => {
    expect(formatSms("Don’t “miss” the 9–5 café — it’s due…")).toBe(
      'MEGS: Don\'t "miss" the 9-5 cafe - it\'s due...'
    );
  });

  it("replaces characters outside printable ASCII with a space and collapses whitespace", () => {
    expect(formatSms("Mabuhay ñ 日本")).toBe("MEGS: Mabuhay n");
    expect(formatSms("  Please   bring\n\nvalid ID  ")).toBe("MEGS: Please bring valid ID");
  });

  it("adds the MEGS prefix to short text", () => {
    expect(formatSms("Interview at 9am")).toBe("MEGS: Interview at 9am");
  });

  it("keeps a text that is exactly 160 characters with its full length", () => {
    const result = formatSms("x".repeat(154));
    expect(result).toBe(`MEGS: ${"x".repeat(154)}`);
    expect(result).toHaveLength(160);
  });

  it("caps long text at 160 characters, ending in an ellipsis", () => {
    const result = formatSms("x".repeat(300));
    expect(result).toHaveLength(160);
    expect(result).toBe(`MEGS: ${"x".repeat(151)}...`);
  });

  it("does not leave a space before the ellipsis when the cut lands on a word break", () => {
    const result = formatSms(`${"a".repeat(150)} ${"b".repeat(100)}`);
    expect(result).toHaveLength(159);
    expect(result).toBe(`MEGS: ${"a".repeat(150)}...`);
  });
});

describe("smsFor", () => {
  it.each(["soon", "today", "overdue-0", "expiring-7", "expired"])("sends an SMS for milestone %s", (milestone) => {
    expect(smsFor(milestone, "Deadline text")).toBe("Deadline text");
  });

  it.each(["overdue-1", "overdue-3", "expiring-30"])("does not send an SMS for milestone %s", (milestone) => {
    expect(smsFor(milestone, "Deadline text")).toBeUndefined();
  });
});
