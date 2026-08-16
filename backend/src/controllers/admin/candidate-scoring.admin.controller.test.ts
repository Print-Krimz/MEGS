import { describe, expect, it, vi } from "vitest";

vi.mock("../utils/prisma.js", () => ({ default: {} }));
vi.mock("../utils/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock("../services/scoring/scoring-configuration.service.js", () => ({
  revalidateConfiguration: vi.fn().mockResolvedValue(undefined),
  getScoringRevalidationStatus: vi.fn(),
}));

import { validateConfiguration } from "./candidate-scoring.admin.controller.js";
import { DEFAULT_WEIGHTS } from '../../services/scoring/scoring-configuration.service.js';

const response = () => {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json };
};

describe("candidate scoring Admin validation contract", () => {
  it("returns the locked defaults without writing", async () => {
    const res = response();
    await validateConfiguration({ body: { weights: DEFAULT_WEIGHTS } } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ weights: DEFAULT_WEIGHTS }),
    }));
  });

  it("returns the required 422 INVALID_CONFIGURATION contract", async () => {
    const res = response();
    await validateConfiguration({ body: { weights: { ...DEFAULT_WEIGHTS, SKILLS: 39 } } } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      code: "INVALID_CONFIGURATION",
      errors: expect.any(Array),
    }));
  });
});
