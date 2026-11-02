import { describe, expect, it } from "vitest";
import { formatSampled } from "../analytics-format";

describe("formatSampled", () => {
  it("explains a missing rate with its sample size", () => {
    expect(formatSampled(null, 4, "%")).toBe("Not enough data (n=4)");
  });
  it("prints percentages and days", () => {
    expect(formatSampled(62.5, 40, "%")).toBe("62.5%");
    expect(formatSampled(18.5, 5, "days")).toBe("18.5 days");
    expect(formatSampled(1, 5, "days")).toBe("1 day");
  });
  it("keeps a real zero", () => {
    expect(formatSampled(0, 9, "%")).toBe("0%");
  });
});
