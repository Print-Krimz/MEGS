import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyScoreCategorization } from "../services/ta/ta.applications.service.js";
import prisma from "../utils/prisma.js";

// Mock prisma and dependencies
vi.mock("../utils/prisma.js", () => ({
  default: {
    application: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    recruiterDecision: {
      create: vi.fn(),
    },
  },
}));

// We need to mock updateTAApplicationStatus but it's in the same file.
// We can mock it by spying on the exported function or extracting it.
// To keep it simple, we will mock the prisma calls directly since updateTAApplicationStatus uses them, 
// but wait, updateTAApplicationStatus is a function we call. 
// A better way is to spy on updateTAApplicationStatus from ta.applications.service.
import * as taService from "../services/ta/ta.applications.service.js";

describe("Candidate Categorization (AI Score)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMockApp = (status: string) => {
    (prisma.application.findUnique as any).mockResolvedValue({ id: 1, status });
  };

  it("should categorize score = 59 as REVIEW", async () => {
    setupMockApp("PARSING");
    await applyScoreCategorization(1, 59);
    expect(prisma.application.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "REVIEW" }) }));
  });

  it("should categorize score = 60 as MATCHED", async () => {
    setupMockApp("PARSING");
    await applyScoreCategorization(1, 60);
    expect(prisma.application.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "MATCHED" }) }));
  });

  it("should categorize score = 100 as MATCHED", async () => {
    setupMockApp("PARSING");
    await applyScoreCategorization(1, 100);
    expect(prisma.application.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "MATCHED" }) }));
  });

  it("should rescore 55 -> 70 moving REVIEW to MATCHED", async () => {
    setupMockApp("REVIEW");
    await applyScoreCategorization(1, 70);
    expect(prisma.application.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "MATCHED" }) }));
  });

  it("should rescore 80 -> 50 moving MATCHED to REVIEW", async () => {
    setupMockApp("MATCHED");
    await applyScoreCategorization(1, 50);
    expect(prisma.application.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "REVIEW" }) }));
  });

  it("should NOT overwrite manual TA progression (e.g. INITIAL_SCREENING) on rescore", async () => {
    setupMockApp("INITIAL_SCREENING");
    await applyScoreCategorization(1, 50);
    expect(prisma.application.update).not.toHaveBeenCalled();
  });

  it("should NOT move candidates in CLIENT_ENDORSEMENT, FINAL_INTERVIEW, HIRED, COMPLIANCE backward", async () => {
    for (const advancedStatus of ["CLIENT_ENDORSEMENT", "FINAL_INTERVIEW", "HIRED", "COMPLIANCE", "DEPLOYED"]) {
      setupMockApp(advancedStatus);
      await applyScoreCategorization(1, 20);
      expect(prisma.application.update).not.toHaveBeenCalled();
    }
  });

  it("should respect dynamic custom threshold (e.g. threshold = 80)", async () => {
    setupMockApp("PARSING");
    await applyScoreCategorization(1, 75, 80);
    expect(prisma.application.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "REVIEW" }) }));

    vi.clearAllMocks();
    setupMockApp("PARSING");
    await applyScoreCategorization(1, 80, 80);
    expect(prisma.application.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "MATCHED" }) }));
  });
});
