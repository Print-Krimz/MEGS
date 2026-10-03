import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
const dependencies = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: dependencies.lookup }));
vi.mock("node:https", () => ({ request: dependencies.request }));
import { downloadLegacyResume, isPublicAddress, validateLegacyResumeUrl } from "../../src/security/legacy-resume-download.js";

describe("legacy resume HTTP boundary", () => {
  beforeEach(() => { vi.stubEnv("LEGACY_RESUME_HOSTS", "legacy.example.com"); dependencies.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]); dependencies.request.mockReset(); });
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
  function response(status: number, headers: object, chunks: Buffer[] = []) {
    dependencies.request.mockImplementation((_url, options, listener) => {
      const incoming = Object.assign(new EventEmitter(), { statusCode: status, headers, destroy: vi.fn() });
      const req = Object.assign(new EventEmitter(), {
        destroy(error?: Error) { if (error) req.emit("error", error); req.emit("close"); },
        end() { queueMicrotask(() => { listener(incoming); for (const chunk of chunks) incoming.emit("data", chunk); incoming.emit("end"); req.emit("close"); }); },
      });
      // Exercise both modern Node auto-family and ordinary custom lookup forms.
      options.lookup("legacy.example.com", { all: true }, (error: unknown, results: unknown) => { expect(error).toBeNull(); expect(results).toEqual([{ address: "93.184.216.34", family: 4 }]); });
      options.lookup("legacy.example.com", { all: false }, (error: unknown, address: string) => { expect(error).toBeNull(); expect(address).toBe("93.184.216.34"); });
      return req;
    });
  }
  it("accepts only exact approved HTTPS hosts without credentials or custom ports", () => {
    expect(validateLegacyResumeUrl("https://legacy.example.com/resume.pdf").hostname).toBe("legacy.example.com");
    for (const value of ["/admin", "http://legacy.example.com/a", "https://legacy.example.com.evil/a", "https://u:p@legacy.example.com/a", "https://legacy.example.com:444/a", "https://127.0.0.1/a"]) expect(() => validateLegacyResumeUrl(value)).toThrow();
  });
  it("rejects private, metadata, mapped IPv6, multicast and mixed DNS answers before HTTP", async () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "172.16.0.1", "192.168.1.2", "100.64.0.1", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "ff02::1", "2001::1", "2001:0000::1", "2002:7f00:1::1", "3fff::1"]) expect(isPublicAddress(address)).toBe(false);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
    dependencies.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }, { address: "10.1.1.1", family: 4 }]);
    await expect(downloadLegacyResume("https://legacy.example.com/a")).rejects.toThrow("restricted");
    expect(dependencies.request).not.toHaveBeenCalled();
  });
  it("pins the validated address and preserves bounded approved downloads", async () => {
    response(200, { "content-type": "application/pdf", "content-length": "11" }, [Buffer.from("safe resume")]);
    expect((await downloadLegacyResume("https://legacy.example.com/resume.pdf")).buffer.toString()).toBe("safe resume");
    expect(dependencies.request.mock.calls[0][1].agent).toBe(false);
  });
  it("rejects redirects, transport compression and excessive advertised or streamed bytes", async () => {
    for (const headers of [{ location: "http://169.254.169.254" }, { "content-encoding": "gzip" }, { "content-length": "6000000" }]) {
      response("location" in headers ? 302 : 200, headers);
      await expect(downloadLegacyResume("https://legacy.example.com/a")).rejects.toThrow();
    }
    response(200, {}, [Buffer.alloc(6 * 1024 * 1024)]);
    await expect(downloadLegacyResume("https://legacy.example.com/a")).rejects.toThrow();
  });
  it("terminates slow requests at the total deadline", async () => {
    vi.useFakeTimers();
    const destroy = vi.fn();
    dependencies.request.mockImplementation(() => {
      const req = Object.assign(new EventEmitter(), { end() {}, destroy(error: Error) { destroy(); req.emit("error", error); req.emit("close"); } });
      return req;
    });
    const pending = downloadLegacyResume("https://legacy.example.com/a");
    const rejection = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(15_001); await rejection; expect(destroy).toHaveBeenCalled();
  });
});
