import { describe, expect, it, vi } from "vitest";
const models = vi.hoisted(() => ({ find: vi.fn() }));
vi.mock("../../src/utils/prisma.js", () => ({ default: { application: { findUnique: models.find } } }));
vi.mock("../../src/utils/supabase.js", () => ({ default: {} }));
vi.mock("../../src/utils/gemini.js", () => ({ analyzeResume: vi.fn(), analyzeResumeFromBuffer: vi.fn() }));
vi.mock("../../src/utils/notification.js", () => ({ sendNotification: vi.fn(), sendRoleNotification: vi.fn() }));
import { enqueueResumeAnalysis, getQueueStatus } from "../../src/workers/resume.worker.js";
describe("resume queue admission", () => {
  it("deduplicates, bounds admitted work, rejects overflow and accepts retry after draining", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let release!: () => void;
    models.find.mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
    for (let id = 1; id <= 100; id++) enqueueResumeAnalysis(id);
    enqueueResumeAnalysis(1);
    expect(getQueueStatus().size + getQueueStatus().pending).toBe(100);
    expect(() => enqueueResumeAnalysis(101)).toThrow("busy");
    release();
    while (getQueueStatus().size + getQueueStatus().pending) await new Promise(resolve => setTimeout(resolve, 1));
    expect(() => enqueueResumeAnalysis(101)).not.toThrow();
    while (getQueueStatus().size + getQueueStatus().pending) await new Promise(resolve => setTimeout(resolve, 1));
    log.mockRestore(); error.mockRestore();
  });
});
