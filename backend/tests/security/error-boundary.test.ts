import { describe, expect, it, vi } from "vitest";
import { sendError } from "../../src/utils/response.js";
import { publicErrorMessage, redactSensitiveText, safeLogError } from "../../src/security/errors.js";

const fakeProviderError = "password=fake-secret alice@example.test https://storage.example/private?token=fake-token Bearer fake-jwt eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.signature 123456";
describe("public and logged error boundaries", () => {
  it.each([400, 401, 403, 404, 500, 503])("omits provider details and error payloads at %i", status => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    sendError(res as any, fakeProviderError, status, { provider: fakeProviderError });
    const body = res.json.mock.calls[0]![0];
    expect(JSON.stringify(body)).not.toMatch(/alice|fake-secret|fake-token|fake-jwt|eyJ|123456/);
    expect(body.error).toBeUndefined();
    if (status >= 500) expect(body.reference).toMatch(/^[a-f0-9-]{36}$/);
  });
  it("retains fixed business validation and controlled cooldown details", () => {
    expect(publicErrorMessage("Current password is incorrect", 400)).toBe("Current password is incorrect");
    expect(publicErrorMessage("Please wait 42 seconds before requesting another code.", 429)).toContain("42");
    expect(publicErrorMessage("Please wait fake-secret seconds before requesting another code.", 429)).not.toContain("fake-secret");
  });
  it("retains structured form validation while stripping unsafe field text", () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    sendError(res as any, "Validation failed", 400, { errors: [{ field: "body.email", message: "Invalid email address" }] });
    expect(res.json.mock.calls[0]![0].error.errors).toEqual([{ field: "body.email", message: "Invalid email address" }]);
  });
  it("redacts fake credentials, addresses, signed URLs, JWTs and numeric codes", () => {
    expect(redactSensitiveText(fakeProviderError)).not.toMatch(/alice|fake-secret|fake-token|fake-jwt|eyJ|123456/);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ref = safeLogError("Provider operation", new Error(fakeProviderError));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining(ref));
    expect(JSON.stringify(spy.mock.calls)).not.toContain("fake-secret"); spy.mockRestore();
  });
  it("redacts quoted diagnostic fields and contiguous phone values", () => {
    const text = '{"password":"synthetic-value","api_key":"fake-value","phone":"09171234567"}';
    expect(redactSensitiveText(text)).not.toMatch(/synthetic-value|fake-value|09171234567/);
  });
});
