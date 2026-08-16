import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("Mailer Utility (Nodemailer)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it("falls back to mock log mode when SMTP credentials are not configured", async () => {
    delete process.env.SMTP_USER;
    delete process.env.GMAIL_USER;
    delete process.env.SMTP_PASS;
    delete process.env.GMAIL_APP_PASSWORD;

    const { sendMail } = await import("../utils/mailer.js");

    const result = await sendMail(
      "applicant@example.com",
      "Interview Update",
      "Your interview is confirmed",
      "<p>Your interview is confirmed</p>"
    );

    expect(result).toEqual({ success: true, messageId: "dev-mock-id" });
  });

  it("sends email via Nodemailer transport when Gmail / SMTP credentials are provided", async () => {
    process.env.GMAIL_USER = "recruiter@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";
    process.env.EMAIL_FROM = '"MEGS Recruitment" <recruiter@gmail.com>';

    const mockSendMail = vi.fn().mockResolvedValue({ messageId: "gmail-msg-12345" });

    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: vi.fn().mockReturnValue({
          sendMail: mockSendMail,
        }),
      },
    }));

    const { sendMail } = await import("../utils/mailer.js");

    const result = await sendMail(
      "candidate@example.com",
      "Offer Letter",
      "Congratulations!",
      "<strong>Congratulations!</strong>"
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("gmail-msg-12345");
    expect(mockSendMail).toHaveBeenCalledWith({
      from: '"MEGS Recruitment" <recruiter@gmail.com>',
      to: "candidate@example.com",
      subject: "Offer Letter",
      text: "Congratulations!",
      html: "<strong>Congratulations!</strong>",
    });
  });

  it("handles errors thrown by nodemailer gracefully and propagates error", async () => {
    process.env.SMTP_USER = "recruiter@megs.com";
    process.env.SMTP_PASS = "secret-pass";

    const mockSendMail = vi.fn().mockRejectedValue(new Error("SMTP connection timeout"));

    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: vi.fn().mockReturnValue({
          sendMail: mockSendMail,
        }),
      },
    }));

    const { sendMail } = await import("../utils/mailer.js");

    await expect(
      sendMail("candidate@example.com", "Test", "Test body")
    ).rejects.toThrow("SMTP connection timeout");
  });
});
