import { describe, expect, it, vi } from "vitest";
const models = vi.hoisted(() => ({ find: vi.fn() }));
vi.mock("../../src/utils/prisma.js", () => ({ default: { application: { findUnique: models.find } } }));
vi.mock("../../src/utils/supabase.js", () => ({ default: {} }));
vi.mock("../../src/utils/gemini.js", () => ({ analyzeResume: vi.fn(), analyzeResumeFromBuffer: vi.fn() }));
vi.mock("../../src/utils/notification.js", () => ({ sendNotification: vi.fn(), sendRoleNotification: vi.fn() }));
import { enqueueResumeAnalysis, getQueueStatus, waitForResumeQueue } from "../../src/workers/resume.worker.js";
describe("resume queue admission", () => {
  it("waits instead of rejecting overflow and deduplicates queued work", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let release!: () => void;
    models.find.mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
    const admissions = Array.from({ length: 151 }, (_, i) => enqueueResumeAnalysis(i + 1));
    await enqueueResumeAnalysis(1);
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(getQueueStatus()).toEqual({ size: 1, pending: 1 });
    release(); await Promise.all(admissions); await waitForResumeQueue();
    expect(models.find).toHaveBeenCalledTimes(151);
    expect(getQueueStatus()).toEqual({ size: 0, pending: 0 });
    log.mockRestore(); error.mockRestore();
  });
});
