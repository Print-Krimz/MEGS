import { describe, it, expect, vi, beforeEach } from "vitest";
import { getScopedComplianceApplications } from "../../src/services/ta/ta.compliance.service.js";
import prisma from "../../src/utils/prisma.js";

vi.mock("../../src/utils/prisma.js", () => ({
  default: {
    application: {
      findMany: vi.fn(),
    },
  },
}));

describe("getScopedComplianceApplications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters pre-employment candidates by COMPLIANCE and CONTRACT_AND_ORIENTATION stages", async () => {
    (prisma.application.findMany as any).mockResolvedValueOnce([
      { id: 101, status: "COMPLIANCE", complianceRequirements: [{ id: 1, reviewStatus: "PENDING" }] },
    ]);

    const result = await getScopedComplianceApplications("PRE_DEPLOYMENT");
    expect(prisma.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isArchived: false,
          status: { in: ["COMPLIANCE", "CONTRACT_AND_ORIENTATION"] },
        }),
      })
    );
    expect(result).toHaveLength(1);
  });

  it("filters post-deployment workers by DEPLOYED status with to-follow requirements", async () => {
    (prisma.application.findMany as any).mockResolvedValueOnce([
      {
        id: 201,
        status: "DEPLOYED",
        complianceRequirements: [
          { id: 2, reviewStatus: "TO_FOLLOW", toFollowExpectedAt: new Date("2026-10-30") },
        ],
      },
    ]);

    const result = await getScopedComplianceApplications("POST_DEPLOYMENT");
    expect(prisma.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isArchived: false,
          status: "DEPLOYED",
          complianceRequirements: {
            some: {
              reviewStatus: { in: ["TO_FOLLOW", "PENDING", "SUBMITTED", "REJECTED"] },
            },
          },
        }),
      })
    );
    expect(result).toHaveLength(1);
  });

  it("returns all non-archived applications when scope is ALL or omitted", async () => {
    (prisma.application.findMany as any).mockResolvedValueOnce([
      { id: 101, status: "COMPLIANCE" },
      { id: 201, status: "DEPLOYED" },
    ]);

    const result = await getScopedComplianceApplications("ALL");
    expect(prisma.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isArchived: false,
        },
      })
    );
    expect(result).toHaveLength(2);

    (prisma.application.findMany as any).mockResolvedValueOnce([
      { id: 101, status: "COMPLIANCE" },
    ]);
    const resultDefault = await getScopedComplianceApplications();
    expect(resultDefault).toHaveLength(1);
  });
});
