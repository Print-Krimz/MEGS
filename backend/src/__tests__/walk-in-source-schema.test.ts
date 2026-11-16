import { describe, expect, it } from "vitest";
import { taSchema } from "../schemas/ta.schema.js";

const body = (over: Record<string, unknown> = {}) => ({
  body: { jobPostingId: "5", firstName: "Juan", lastName: "Dela Cruz", gender: "Male", ...over },
});

describe("createWalkIn schema", () => {
  it("requires a birth date for a walk-in, and for no source given", () => {
    expect(taSchema.createWalkIn.safeParse(body()).success).toBe(false);
    expect(taSchema.createWalkIn.safeParse(body({ source: "WALK_IN" })).success).toBe(false);
    expect(taSchema.createWalkIn.safeParse(body({ source: "WALK_IN", birthDate: "1990-05-09" })).success).toBe(true);
  });

  it("lets other sources leave the birth date out, but still checks it when given", () => {
    expect(taSchema.createWalkIn.safeParse(body({ source: "LINKEDIN" })).success).toBe(true);
    expect(taSchema.createWalkIn.safeParse(body({ source: "JOBSTREET", birthDate: "" })).success).toBe(true);
    expect(taSchema.createWalkIn.safeParse(body({ source: "LINKEDIN", birthDate: "2015-01-01" })).success).toBe(false);
  });

  it("rejects ONLINE and unknown sources", () => {
    expect(taSchema.createWalkIn.safeParse(body({ source: "ONLINE", birthDate: "1990-05-09" })).success).toBe(false);
    expect(taSchema.createWalkIn.safeParse(body({ source: "TIKTOK", birthDate: "1990-05-09" })).success).toBe(false);
  });
});
