import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Placeholder addresses (phone sign-ups and walk-ins) have no mailbox. Nothing may send to them.
// The database and the SMTP transport are mocked. Helpers, mailer, notifications and the outbox worker run for real.
const m = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    prisma: {
      user: { findUnique: fn() },
      notification: { create: fn() },
      notificationOutbox: { findMany: fn(), update: fn() },
    } as Record<string, any>,
    transport: { sendMail: vi.fn(async () => ({ messageId: "m-1" })) },
  };
});

vi.mock("../utils/prisma.js", () => ({ default: m.prisma }));
vi.mock("nodemailer", () => {
  const createTransport = vi.fn(() => m.transport);
  return { default: { createTransport }, createTransport };
});

import { displayEmail } from "../utils/display-email.js";
import { isPhoneSyntheticEmail, isSyntheticEmail } from "../utils/sms.js";
import { sendMail } from "../utils/mailer.js";
import { sendNotification } from "../utils/notification.js";
import { startEmailWorker } from "../workers/email.worker.js";

const PHONE_PLACEHOLDER = "639171234567@applicant.megs.local";
const WALK_IN_PLACEHOLDER = "walkin_3f2a9c1e-7b4d-4c8e-9a1f-2d3e4f5a6b7c@megs.internal";
const REAL = "juan@gmail.com";

// Gives fire-and-forget email work time to run.
const settle = () => new Promise((resolve) => setTimeout(resolve, 25));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SMTP_USER = "mailer@example.com";
  process.env.SMTP_PASS = "not-a-real-password";
  delete process.env.GMAIL_USER;
  delete process.env.GMAIL_APP_PASSWORD;
  delete process.env.LIVE_EMAIL_TEST;
});

afterEach(() => {
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  vi.useRealTimers();
});

describe("isSyntheticEmail and isPhoneSyntheticEmail", () => {
  it.each([PHONE_PLACEHOLDER, WALK_IN_PLACEHOLDER, "639171234567@APPLICANT.megs.local", "  walkin_x@megs.internal  "])(
    "treats %s as a placeholder",
    (email) => {
      expect(isSyntheticEmail(email)).toBe(true);
    }
  );

  it.each([
    REAL,
    "hr@megs.com",
    "someone@megs.internal.example.com",
    "someone@applicant.megs.local.example.com",
    "someone@notmegs.internal",
    "megs.internal",
    "",
  ])("does not treat %s as a placeholder", (email) => {
    expect(isSyntheticEmail(email)).toBe(false);
  });

  it("returns false for null and undefined", () => {
    expect(isSyntheticEmail(null as any)).toBe(false);
    expect(isSyntheticEmail(undefined as any)).toBe(false);
  });

  it("identifies only the phone-derived form as a phone placeholder", () => {
    expect(isPhoneSyntheticEmail(PHONE_PLACEHOLDER)).toBe(true);
    expect(isPhoneSyntheticEmail(WALK_IN_PLACEHOLDER)).toBe(false);
    expect(isPhoneSyntheticEmail(REAL)).toBe(false);
  });
});

describe("displayEmail", () => {
  it("hides both placeholder forms", () => {
    expect(displayEmail(PHONE_PLACEHOLDER)).toBeNull();
    expect(displayEmail(WALK_IN_PLACEHOLDER)).toBeNull();
  });

  it("passes a real address through unchanged", () => {
    expect(displayEmail(REAL)).toBe(REAL);
  });

  it("returns null for a missing address", () => {
    expect(displayEmail(null)).toBeNull();
    expect(displayEmail(undefined)).toBeNull();
    expect(displayEmail("")).toBeNull();
  });
});

describe("sendMail", () => {
  it.each([PHONE_PLACEHOLDER, WALK_IN_PLACEHOLDER])("skips the placeholder %s without touching the transport", async (to) => {
    const result = await sendMail(to, "Subject", "Body", "<p>Body</p>");
    expect(result).toEqual({ success: true });
    expect(m.transport.sendMail).not.toHaveBeenCalled();
  });

  it("still sends to a real address, so the skip above is the only reason nothing was sent", async () => {
    const result = await sendMail(REAL, "Subject", "Body", "<p>Body</p>");
    expect(result).toEqual({ success: true, messageId: "m-1" });
    expect(m.transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: REAL, subject: "Subject" }));
  });
});

describe("sendNotification", () => {
  it("delivers the in-app notification but emails nobody when the account has a placeholder address", async () => {
    m.prisma.user.findUnique.mockResolvedValueOnce({ email: WALK_IN_PLACEHOLDER, role: "APPLICANT" });
    m.prisma.notification.create.mockResolvedValueOnce({ id: 1 });

    await sendNotification("walk-in-1", "Job Invitation Received", "You have an offer.", "INFO", "/app/invitations", {
      sendEmail: true,
    });
    await settle();

    expect(m.prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(m.transport.sendMail).not.toHaveBeenCalled();
  });

  it("does not email an explicit placeholder recipient", async () => {
    await sendNotification("walk-in-1", "Title", "Message", "INFO", null, {
      sendEmail: true,
      recipientEmail: PHONE_PLACEHOLDER,
    });
    await settle();
    expect(m.transport.sendMail).not.toHaveBeenCalled();
  });

  it("emails a real address through the same path, as a control", async () => {
    m.prisma.user.findUnique.mockResolvedValueOnce({ email: REAL, role: "APPLICANT" });
    m.prisma.notification.create.mockResolvedValueOnce({ id: 2 });

    await sendNotification("user-1", "Title", "Message", "INFO", null, { sendEmail: true });
    await vi.waitFor(() => expect(m.transport.sendMail).toHaveBeenCalledTimes(1));
    expect(m.transport.sendMail.mock.calls[0][0]).toMatchObject({ to: REAL });
  });
});

describe("email outbox worker", () => {
  it("marks queued mail to a placeholder FAILED without sending, and still sends to a real address", async () => {
    // Stop the polling interval so only the first pass runs.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    m.prisma.notificationOutbox.findMany.mockResolvedValueOnce([
      { id: 7, subject: "Offer", body: "Open the tracker", attempts: 0, recipient: { email: WALK_IN_PLACEHOLDER } },
      { id: 8, subject: "Offer", body: "Open the tracker", attempts: 0, recipient: { email: REAL } },
    ]);
    m.prisma.notificationOutbox.update.mockResolvedValue({});

    startEmailWorker();

    await vi.waitFor(() => expect(m.prisma.notificationOutbox.update).toHaveBeenCalledTimes(2));
    expect(m.prisma.notificationOutbox.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({ status: "FAILED", attempts: 1, lastError: "Recipient has no real email address" }),
    });
    expect(m.prisma.notificationOutbox.update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: expect.objectContaining({ status: "SENT", attempts: 1 }),
    });
    expect(m.transport.sendMail).toHaveBeenCalledTimes(1);
    expect(m.transport.sendMail.mock.calls[0][0]).toMatchObject({ to: REAL });
  });
});
