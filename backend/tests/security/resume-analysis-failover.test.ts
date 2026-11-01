import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@google/genai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@google/genai")>()),
  GoogleGenAI: class { models = { generateContent: mocks.generate }; },
}));
import { analyzeResume, getCandidateModels } from "../../src/utils/gemini.js";

const analysis = JSON.stringify({ score: 70, summary: "Good fit.", strengths: [], gaps: [], requirements: [] });
// Retry-After above the 5 s cap fails the model at once, so no real backoff wait in the test.
const busy = () => Object.assign(new Error("unavailable"), { status: 503, headers: { "retry-after": "30" } });

describe("resume analysis with a busy provider (mocked Gemini)", () => {
  beforeEach(() => { mocks.generate.mockReset(); vi.stubEnv("GEMINI_API_KEY", "fake-test-key"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("fails over to the next model on a 503 and uses a 25 s deadline", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    mocks.generate.mockRejectedValueOnce(busy()).mockResolvedValueOnce({ text: analysis });

    expect((await analyzeResume("resume", "Analyst", "SQL")).score).toBe(70);

    const models = getCandidateModels();
    expect(mocks.generate).toHaveBeenCalledTimes(2);
    expect(mocks.generate.mock.calls[0][0].model).toBe(models[0]);
    expect(mocks.generate.mock.calls[1][0].model).toBe(models[1]);
    expect(timeout.mock.calls.every(([ms]) => ms === 25_000)).toBe(true);
  });

  it("still fails with the busy error once every model is busy", async () => {
    mocks.generate.mockRejectedValue(busy());
    await expect(analyzeResume("resume", "Analyst", "SQL")).rejects.toMatchObject({ retryable: true, status: 503 });
    expect(mocks.generate).toHaveBeenCalledTimes(getCandidateModels().length);
  });
});
