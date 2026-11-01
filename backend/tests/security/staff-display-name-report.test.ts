import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applicationFindMany: vi.fn(),
  backoutFindMany: vi.fn(),
  closureFindMany: vi.fn(),
  deploymentFindMany: vi.fn(),
  endorsementFindMany: vi.fn(),
  endorsementGroupBy: vi.fn(),
  decisionFindMany: vi.fn(),
  decisionGroupBy: vi.fn(),
  requirementFindMany: vi.fn(),
  userFindMany: vi.fn(),
  mrfFindMany: vi.fn(),
  mrfCount: vi.fn(),
}));

vi.mock("../../src/utils/prisma.js", () => ({
  default: {
    application: { findMany: mocks.applicationFindMany },
    applicationBackout: { findMany: mocks.backoutFindMany },
    applicationClosure: { findMany: mocks.closureFindMany },
    deployment: { findMany: mocks.deploymentFindMany },
    clientEndorsement: { findMany: mocks.endorsementFindMany, groupBy: mocks.endorsementGroupBy },
    recruiterDecision: { findMany: mocks.decisionFindMany, groupBy: mocks.decisionGroupBy },
    complianceRequirement: { findMany: mocks.requirementFindMany },
    user: { findMany: mocks.userFindMany },
    manpowerRequest: { findMany: mocks.mrfFindMany, count: mocks.mrfCount },
  },
}));

import { getAdminDelivery, getAdminReportData, getTADelivery } from "../../src/services/analytics/delivery.service.js";
import { POST_SELECTION_STAGES } from "../../src/services/analytics/metric-definitions.js";

const own = (id: string) => ({ OR: [{ mrf: { is: { assignedTaId: id } } }, { mrfId: null, postedById: id }] });
const ta = (id: string, name: string) => ({ id, role: "TALENT_ACQUISITION", email: `${name}@megs.ph`, applicantProfile: null });
const mrf = (over: Record<string, unknown> = {}) => ({
  id: 1, title: "Welder", headcount: 2, status: "OPEN", targetFillDate: null, clientId: 7,
  client: { name: "Acme" }, assignedTaId: "ta-busy", assignedTa: ta("ta-busy", "busy"), deployments: [], _count: { jobPostings: 1 }, ...over,
});
const app = (over: Record<string, unknown> = {}, job: Record<string, unknown> = {}) => ({
  id: 1, status: "COMPLIANCE", createdAt: new Date("2026-08-01T00:00:00Z"),
  user: { email: "c@x.ph", applicantProfile: null },
  jobPosting: { title: "Cashier", mrfId: null, status: "OPEN", postedById: "admin-1", mrf: null, ...job },
  recruiterDecisions: [], // read by the drop-off query on the TA page
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of Object.values(mocks)) fn.mockResolvedValue([]);
  mocks.mrfCount.mockResolvedValue(0);
});

describe("staff names in report data", () => {
  it("changes labels without changing owner UUIDs or candidate counts", async () => {
    const staff = { ...ta("ta-busy", "busy"), displayName: "Ana Cruz" };
    mocks.userFindMany.mockResolvedValue([staff]);
    mocks.mrfFindMany.mockResolvedValue([mrf({ assignedTa: staff })]);
    mocks.applicationFindMany.mockResolvedValue([app({ id: 1 }, { postedById: "ta-busy" })]);
    const { result } = await getAdminReportData({ range: "7d" });
    expect(result.team[0]).toMatchObject({ recruiterId: "ta-busy", name: "Ana Cruz", active: 1 });
    expect(result.requests[0].ownerName).toBe("Ana Cruz");
    expect(result.kpis.activeApplicants).toBe(1);
  });
});
