import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendSms } from "../../src/utils/sms.js";

const reply = (body: unknown, status = 200) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("sendSms (Semaphore)", () => {
  beforeEach(() => {
    process.env.SEMAPHORE_API_KEY = "test-key";
    delete process.env.SEMAPHORE_SENDER_NAME;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("posts a form with the local number and MEGSINC sender, returns the message id", async () => {
    const spy = reply([{ message_id: 12345, status: "Pending" }]);
    await expect(sendSms("+639171234567", "hi")).resolves.toEqual({ success: true, messageId: "12345" });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.semaphore.co/api/v4/messages");
    const body = init.body as URLSearchParams;
    expect(body.get("number")).toBe("09171234567");
    expect(body.get("sendername")).toBe("MEGSINC");
    expect(body.get("apikey")).toBe("test-key");
    expect(body.get("message")).toBe("hi");
  });

  it("reports Semaphore's error object as a failed send", async () => {
    reply({ apikey: ["Invalid API key."] }, 401);
    await expect(sendSms("09171234567", "hi")).resolves.toEqual({ success: false, error: "Invalid API key." });
  });

  it("treats a Failed status as a failed send", async () => {
    reply([{ message_id: 1, status: "Failed" }]);
    expect((await sendSms("09171234567", "hi")).success).toBe(false);
  });

  it("fails without calling the network when the key is missing", async () => {
    delete process.env.SEMAPHORE_API_KEY;
    const spy = vi.spyOn(globalThis, "fetch");
    expect(await sendSms("09171234567", "hi")).toEqual({ success: false, error: "SEMAPHORE_API_KEY not configured" });
    expect(spy).not.toHaveBeenCalled();
  });
});
