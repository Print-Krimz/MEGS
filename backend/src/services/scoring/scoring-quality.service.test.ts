import { describe, expect, it, vi } from "vitest";

vi.mock("../../utils/prisma.js", () => ({ default: {} }));

import { percentile95 } from "./scoring-quality.service.js";

describe("scoring quality metrics", () => {
  it("calculates a deterministic p95 from recorded KNN latency samples", () => {
    expect(percentile95([8, 2, 12, 4, 10])).toBe(12);
    expect(percentile95([])).toBeNull();
  });
});
