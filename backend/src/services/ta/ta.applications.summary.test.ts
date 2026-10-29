import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    application: { count: vi.fn(), findMany: vi.fn() },
    queryRaw: vi.fn(),
  },
  generateComplianceRequirementsFromMRF: vi.fn(),
  dynamicScoringEnabled: vi.fn(),
}));

vi.mock("../../utils/prisma.js", () => ({
  default: {
    application: mocks.prisma.application,
    deployment: { findMany: vi.fn().mockResolvedValue([]) },
    recruiterDecision: { groupBy: vi.fn().mockResolvedValue([]) },
    $queryRaw: mocks.prisma.queryRaw,
  },
}));
vi.mock("../../utils/notification.js", () => ({ notifyJobOwner: vi.fn(async () => 0), notifyOwner: vi.fn(async () => 0), sendNotification: vi.fn(), sendRoleNotification: vi.fn() }));
vi.mock("../../utils/scoring-flags.js", () => ({
  scoringFlags: { dynamicCandidateScoringEnabled: mocks.dynamicScoringEnabled },
}));
vi.mock("../scoring/scoring-configuration.service.js", () => ({
  getActiveScoringConfiguration: vi.fn(),
}));
vi.mock("./ta.compliance.service.js", () => ({
  isFullyCompliant: vi.fn(),
  generateComplianceRequirementsFromMRF: mocks.generateComplianceRequirementsFromMRF,
}));
vi.mock("../../utils/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock("../document/document.service.js", () => ({ resolveDocumentSignedUrl: vi.fn() }));
vi.mock("../scoring/talent-pool-knn.service.js", () => ({ rebuildCandidateFeatureProfile: vi.fn() }));

import { listTAApplications } from "./ta.applications.service.js";

const complianceRow = (id: number, complianceRequirements: number) => ({
  id,
  status: "COMPLIANCE",
  aiScore: null,
  isArchived: false,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  jobPosting: {
    id: 10,
    title: "Technician",
    location: "Pasig",
    mrf: { id: 3, title: "Service Team", clientId: 4, client: { id: 4, name: "Example Client" } },
  },
  user: { id: `user-${id}`, email: `user-${id}@example.com`, applicantProfile: { firstName: "Alex", lastName: "Worker" } },
  _count: { interviews: 0, recruiterDecisions: 0, complianceRequirements },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.dynamicScoringEnabled.mockReturnValue(false);
  mocks.prisma.application.count.mockResolvedValue(2);
  mocks.prisma.application.findMany.mockResolvedValue([complianceRow(11, 0), complianceRow(12, 2)]);
  mocks.prisma.queryRaw.mockResolvedValueOnce([{ id: 11 }, { id: 12 }]).mockResolvedValue([]);
});

describe("TA application summary compliance read-only policy", () => {
  it("does not mutate compliance requirements during list reads", async () => {
    const result = await listTAApplications({ summary: true, status: "COMPLIANCE", page: 1, limit: 10 });

    expect(mocks.prisma.application.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        _count: { select: { interviews: true, recruiterDecisions: true, complianceRequirements: true } },
      }),
    }));
    // List read is strictly read-only: no generateComplianceRequirementsFromMRF call
    expect(mocks.generateComplianceRequirementsFromMRF).not.toHaveBeenCalled();
    expect(result.items).toHaveLength(2);
  });
});
