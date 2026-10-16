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

vi.mock("../../utils/prisma.js", () => ({
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

import { getAdminDelivery, getAdminReportData, getTADelivery, getTAReportData } from "./delivery.service.js";
import { FIXTURE_FILTERS, FIXTURE_NOW, buildWorld, wireWorld } from "./delivery.fixtures.js";

const snap = (name: string) => `./__fixtures__/delivery-parity/${name}.json`;
const json = (v: unknown) => JSON.stringify(v, null, 1) + "\n";

function world() {
  const w = buildWorld(120, 14);
  const at = (iso: string) => new Date(iso);
  // Manila boundaries: 00:00 PHT on the first day and 23:59:59.999 PHT on the last day of the range.
  const base = w.deployments[0];
  w.deployments.push(
    { ...base, id: 9001, actualStart: at("2026-09-14T16:00:00Z"), mrf: { ...base.mrf!, createdAt: at("2026-09-14T15:59:00Z") }, createdAt: at("2026-09-01T00:00:00Z") },
    { ...base, id: 9002, actualStart: at("2026-10-14T15:59:59.999Z"), mrf: { ...base.mrf!, createdAt: at("2026-10-14T16:00:00Z") }, createdAt: at("2026-09-02T00:00:00Z") }
  );
  // A repeated application attempt for the same person and opening.
  const first = w.appRows[0];
  w.appRows.push({ ...first, id: 9100, attemptNumber: 2, createdAt: at("2026-10-10T00:00:00Z") });
  // Unassigned work: opening posted by an administrator with no requisition.
  w.appRows.push({ ...w.appRows[1], id: 9101, userId: "solo", status: "COMPLIANCE", jobPosting: { title: "Walk-in", mrfId: null, status: "OPEN", postedById: "admin-1", mrf: null } });
  w.requirements.push({ applicationId: 9101 });
  return w;
}

beforeEach(() => {
  vi.clearAllMocks();
  wireWorld(mocks, world());
});

const ta1 = { role: "TALENT_ACQUISITION", userId: "ta-1" } as any;

describe("delivery dashboards and reports keep their output", () => {
  it("TA dashboard", async () => {
    await expect(json(await getTADelivery({ ...FIXTURE_FILTERS }, ta1, FIXTURE_NOW))).toMatchFileSnapshot(snap("ta-dashboard"));
  });
  it("TA report", async () => {
    await expect(json(await getTAReportData({ ...FIXTURE_FILTERS }, ta1, FIXTURE_NOW))).toMatchFileSnapshot(snap("ta-report"));
  });
  it("Admin dashboard", async () => {
    await expect(json(await getAdminDelivery({ ...FIXTURE_FILTERS }, FIXTURE_NOW))).toMatchFileSnapshot(snap("admin-dashboard"));
  });
  it("Admin report", async () => {
    await expect(json(await getAdminReportData({ ...FIXTURE_FILTERS }, FIXTURE_NOW))).toMatchFileSnapshot(snap("admin-report"));
  });
  it("Admin dashboard filtered to one recruiter", async () => {
    const f = { ...FIXTURE_FILTERS, recruiterId: "ta-2" };
    await expect(json(await getAdminDelivery(f, FIXTURE_NOW))).toMatchFileSnapshot(snap("admin-dashboard-ta2"));
    await expect(json(await getAdminReportData(f, FIXTURE_NOW))).toMatchFileSnapshot(snap("admin-report-ta2"));
  });
});

describe("dashboard and report share one metric definition", () => {
  it("TA dashboard equals the report's result", async () => {
    const dash = await getTADelivery({ ...FIXTURE_FILTERS }, ta1, FIXTURE_NOW);
    const report = await getTAReportData({ ...FIXTURE_FILTERS }, ta1, FIXTURE_NOW);
    expect(dash).toEqual(report.result);
    expect(report.detail.starts.length).toBe(report.result.kpis.placementsStarted);
    expect(report.detail.candidates.filter((c) => c.status !== "AWAITING_START").length).toBe(report.result.kpis.activeApplicants);
  });
  it("Admin dashboard equals the report's result", async () => {
    const dash = await getAdminDelivery({ ...FIXTURE_FILTERS }, FIXTURE_NOW);
    const report = await getAdminReportData({ ...FIXTURE_FILTERS }, FIXTURE_NOW);
    expect(dash).toEqual(report.result);
    expect(report.detail.overdueTotal).toBe(report.result.stuckTotal);
    expect(report.detail.backouts.length).toBe(report.result.backouts.withdrawals + report.result.backouts.backouts);
  });
});
