import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
const workers = vi.hoisted(() => ({ instances: [] as any[], hold: false }));
vi.mock("node:worker_threads", () => ({ Worker: class extends EventEmitter {
  release?: () => void;
  constructor() { super(); workers.instances.push(this); }
  terminate = vi.fn(() => workers.hold ? new Promise<number>(resolve => { this.release = () => resolve(1); }) : Promise.resolve(1));
} }));
import { extractDocumentText } from "../../src/security/document-parser.js";
const fakePdf = Buffer.from("%PDF-1.4\n%%EOF");
describe("isolated parser lifecycle", () => {
  afterEach(() => { vi.useRealTimers(); workers.instances.length = 0; workers.hold = false; });
  it("terminates timed out CPU work and releases capacity only after actual termination", async () => {
    vi.useFakeTimers(); workers.hold = true;
    const first = extractDocumentText(fakePdf, "application/pdf");
    const firstFailure = expect(first).rejects.toThrow("deadline");
    const second = extractDocumentText(fakePdf, "application/pdf");
    const secondFailure = expect(second).rejects.toThrow("deadline");
    await expect(extractDocumentText(fakePdf, "application/pdf")).rejects.toThrow("busy");
    await vi.advanceTimersByTimeAsync(10_001);
    expect(workers.instances[0].terminate).toHaveBeenCalled();
    await expect(extractDocumentText(fakePdf, "application/pdf")).rejects.toThrow("busy");
    // Both mock terminations need independent release functions.
    for (const instance of workers.instances) instance.release?.();
    await Promise.all([firstFailure, secondFailure]);
  });
  it("rejects an unexpected clean worker exit instead of waiting forever", async () => {
    const result = extractDocumentText(fakePdf, "application/pdf");
    workers.instances[0].emit("exit", 0);
    await expect(result).rejects.toThrow("stopped before completing");
  });
});
