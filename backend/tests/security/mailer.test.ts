import { afterEach, describe, expect, it, vi } from "vitest";
import {
  redactAuthenticationSecrets,
  sendMail,
} from "../../src/utils/mailer.js";

describe("mailer secret handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.NODE_ENV;
  });

  it("redacts token-bearing URLs, bearer tokens, and OTPs", () => {
    const value = "https://app/setup?token=secret-value code=123456 Bearer abc.def.ghi";
    const redacted = redactAuthenticationSecrets(value);
    expect(redacted).not.toContain("secret-value");
    expect(redacted).not.toContain("123456");
    expect(redacted).not.toContain("abc.def.ghi");
  });

  it("fails clearly in production when email is not configured", async () => {
    process.env.NODE_ENV = "production";
    await expect(sendMail("user@example.com", "Subject", "Body")).rejects.toThrow(
      "SMTP is not configured"
    );
  });

  it("logs only redacted content in development fallback", async () => {
    process.env.NODE_ENV = "development";
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await sendMail(
      "user@example.com",
      "Invitation",
      "Open https://app/setup?token=secret-value and enter 123456"
    );
    const output = log.mock.calls.flat().join(" ");
    expect(output).not.toContain("secret-value");
    expect(output).not.toContain("123456");
  });
});
