import { describe, expect, it, vi } from "vitest";

vi.mock("../../utils/prisma.js", () => ({ default: {} }));

import { buildSourceMix } from "./delivery.service.js";

describe("buildSourceMix", () => {
  it("counts received and hired per source, largest first", () => {
    const rows = [
      { source: "LINKEDIN", status: "DEPLOYED" },
      { source: "LINKEDIN", status: "SUBMITTED" },
      { source: "LINKEDIN", status: "INITIAL_SCREENING" },
      { source: "WALK_IN", status: "DEPLOYED" },
      { source: "ONLINE", status: "REJECTED" },
    ];
    expect(buildSourceMix(rows)).toEqual([
      { source: "LINKEDIN", received: 3, hired: 1 },
      { source: "ONLINE", received: 1, hired: 0 },
      { source: "WALK_IN", received: 1, hired: 1 },
    ]);
  });

  it("returns nothing when there are no applications", () => {
    expect(buildSourceMix([])).toEqual([]);
  });
});
