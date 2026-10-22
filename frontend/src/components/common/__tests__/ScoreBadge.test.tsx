import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";

vi.mock("../../../lib/config", () => ({ useGlobalConfig: () => ({ data: { matchThreshold: 70 } }) }));

import { ScoreBadge } from "../ScoreBadge";

const tone = (score: number) => render(<ScoreBadge score={score} />).container.firstElementChild!.className;

describe("ScoreBadge colour bands (threshold 70)", () => {
  it("is green at or above the threshold", () => {
    expect(tone(70)).toContain("emerald");
    expect(tone(92)).toContain("emerald");
  });

  it("is orange within 25 points below the threshold", () => {
    expect(tone(69)).toContain("orange");
    expect(tone(52)).toContain("orange");
    expect(tone(45)).toContain("orange");
  });

  it("is red further below", () => {
    expect(tone(44)).toContain("rose");
    expect(tone(25)).toContain("rose");
  });
});
