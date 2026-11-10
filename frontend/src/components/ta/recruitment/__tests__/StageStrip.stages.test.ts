import { describe, expect, it } from "vitest";
import { stripStages } from "../StageStrip";

const prod = { REVIEW: 26, MATCHED: 7, INITIAL_SCREENING: 2, COMPLIANCE: 1, CONTRACT_SIGNING: 3, DEPLOYED: 33, BACKOUT: 1, REJECTED: 1 };

describe("stripStages", () => {
  it("shows every status that has rows, so tab counts add up to All", () => {
    const shown = stripStages(prod, undefined, false);
    const sum = shown.reduce((total, stage) => total + ((prod as Record<string, number>)[stage] ?? 0), 0);
    expect(sum).toBe(74);
    expect(shown).toEqual(["SUBMITTED", "REVIEW", "MATCHED", "INITIAL_SCREENING", "CLIENT_ENDORSEMENT", "FINAL_INTERVIEW", "COMPLIANCE", "CONTRACT_SIGNING", "DEPLOYED", "BACKOUT", "REJECTED"]);
  });

  it("hides empty extra statuses but keeps the selected one", () => {
    expect(stripStages({}, undefined, false)).not.toContain("REVIEW");
    expect(stripStages({}, "REVIEW", false)).toContain("REVIEW");
  });

  it("drops Deployed in the open-work queue", () => {
    expect(stripStages(prod, undefined, true)).not.toContain("DEPLOYED");
  });
});
