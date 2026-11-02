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

import { getAdminDelivery, getAdminReportData, getTADelivery } from "./delivery.service.js";
import { POST_SELECTION_STAGES } from "./metric-definitions.js";

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

const decisionInto = (applicationId: number, toStatus: string, at = "2026-01-01T00:00:00Z") => ({ applicationId, toStatus, _max: { createdAt: new Date(at) } });

describe("recruiter list on the admin dashboard", () => {
  it("lists only recruiters with something to show, not every active TA", async () => {
    mocks.userFindMany.mockResolvedValue([ta("ta-busy", "busy"), ta("ta-empty", "empty")]);
    mocks.mrfFindMany.mockResolvedValue([mrf()]);
    const { team } = await getAdminDelivery({ range: "7d" });
    expect(team.map((t) => t.recruiterId)).toEqual(["ta-busy"]);
    expect(team[0]).toMatchObject({ openRequisitions: 1, requestedSeats: 2, filledSeats: 0 });
  });

  it("keeps work no TA owns out of the recruiter rows and reports it as its own problem", async () => {
    mocks.userFindMany.mockResolvedValue([ta("ta-busy", "busy"), { id: "admin-1", role: "ADMINISTRATOR", email: "admin@megs.ph", applicantProfile: null }]);
    mocks.mrfFindMany.mockResolvedValue([mrf()]);
    mocks.applicationFindMany.mockResolvedValue([app()]);
    const { team, unassigned, stuck } = await getAdminDelivery({ range: "7d" });
    expect(team.map((t) => t.name)).toEqual(["busy@megs.ph"]);
    expect(team.some((t) => t.recruiterId === "admin-1" || t.recruiterId === "unassigned")).toBe(false);
    expect(unassigned).toMatchObject({ applicants: 1, requests: 0 });
    expect(unassigned.oldestWaitDays).toBeGreaterThan(30);
    expect(stuck[0]).toMatchObject({ recruiterId: "unassigned", recruiterName: "No recruiter assigned" });
  });

  it("puts a requisition with no assigned TA under unassigned work", async () => {
    mocks.mrfFindMany.mockResolvedValue([mrf({ assignedTaId: null, assignedTa: null, headcount: 3 })]);
    const { team, unassigned, requests } = await getAdminDelivery({ range: "7d" });
    expect(requests[0].ownerName).toBe("No recruiter assigned");
    expect(team).toHaveLength(0);
    expect(unassigned).toMatchObject({ requests: 1, requestedSeats: 3 });
  });

  it("makes team rows plus unassigned work add up to every active applicant", async () => {
    mocks.userFindMany.mockResolvedValue([ta("ta-busy", "busy"), { id: "admin-1", role: "ADMINISTRATOR", email: "a@m.ph", applicantProfile: null }]);
    mocks.applicationFindMany.mockResolvedValue([
      app({ id: 1 }, { postedById: "ta-busy" }),
      app({ id: 2 }, { postedById: "ta-busy" }),
      app({ id: 3 }), // posted by the administrator
    ]);
    const { team, unassigned, kpis } = await getAdminDelivery({ range: "7d" });
    expect(team.reduce((t, r) => t + r.active, 0) + unassigned.applicants).toBe(kpis.activeApplicants);
    expect(kpis.activeApplicants).toBe(3);
  });

  it("still shows a recruiter picked in the filter, even with nothing to show", async () => {
    mocks.userFindMany.mockResolvedValue([ta("ta-empty", "empty")]);
    const { team } = await getAdminDelivery({ range: "7d", recruiterId: "ta-empty" });
    expect(team.map((t) => t.recruiterId)).toEqual(["ta-empty"]);
  });
});

describe("recruiter ownership on the admin dashboard", () => {
  it("scopes candidates, backouts and placements to what that recruiter owns", async () => {
    await getAdminDelivery({ range: "7d", recruiterId: "ta-1" });
    expect(mocks.applicationFindMany.mock.calls[0][0].where.jobPosting).toEqual(own("ta-1"));
    expect(mocks.backoutFindMany.mock.calls[0][0].where.application.jobPosting).toEqual(own("ta-1"));
    expect(mocks.deploymentFindMany.mock.calls[0][0].where.AND[0].OR[0]).toEqual({ mrf: { is: { assignedTaId: "ta-1" } } });
  });

  it("limits requisitions to the ones assigned to that recruiter", async () => {
    await getAdminDelivery({ range: "7d", recruiterId: "ta-1" });
    expect(mocks.mrfFindMany.mock.calls[0][0].where.AND).toContainEqual({ assignedTaId: "ta-1" });
  });

  it("narrows to one job opening without widening it", async () => {
    await getAdminDelivery({ range: "7d", recruiterId: "ta-1", jobPostingId: 55 });
    const and = mocks.mrfFindMany.mock.calls[0][0].where.AND;
    expect(and).toContainEqual({ jobPostings: { some: { id: 55 } } });
    expect(and).toContainEqual({ assignedTaId: "ta-1" });
  });

  it("shows every requisition when no recruiter is selected", async () => {
    await getAdminDelivery({ range: "7d" });
    const and = mocks.mrfFindMany.mock.calls[0][0].where.AND;
    expect(and).toHaveLength(1); // only the open-or-recently-filled condition
  });
});

describe("sampled recruiter rates and request owners", () => {
  const backout = (id: number) => ({
    applicationId: id, stage: POST_SELECTION_STAGES[0], party: "APPLICANT", reason: "OTHER", occurredAt: new Date(), notes: null, recordedBy: null,
    application: { user: null, jobPosting: { title: "Welder", mrfId: 1, postedById: "admin-1", mrf: { assignedTaId: "ta-busy" } } },
  });

  it("hides a recruiter's rates below five cases and reports the sample behind them", async () => {
    mocks.userFindMany.mockResolvedValue([ta("ta-busy", "busy")]);
    mocks.mrfFindMany.mockResolvedValue([mrf()]);
    mocks.backoutFindMany.mockResolvedValue([backout(1), backout(2), backout(3)]);
    const { team } = await getAdminDelivery({ range: "7d" });
    expect(team[0]).toMatchObject({ backouts: 3, backoutRate: null, backoutRateBase: 3, fillRate: null, requestedSeats: 2, medianDaysToFill: null, daysToFillSample: 0 });
  });

  it("shows a request assigned to an administrator as no recruiter assigned", async () => {
    const admin = { id: "admin-1", role: "ADMINISTRATOR", email: "admin@megs.ph", applicantProfile: null };
    mocks.userFindMany.mockResolvedValue([ta("ta-busy", "busy"), admin]);
    mocks.mrfFindMany.mockResolvedValue([
      mrf({ id: 1 }),
      mrf({ id: 2, assignedTaId: "admin-1", assignedTa: admin }),
    ]);
    const { team, unassigned, requests } = await getAdminDelivery({ range: "7d" });
    const byId = (id: number) => requests.find((r) => r.mrfId === id)!;
    expect(byId(2)).toMatchObject({ ownerId: null, ownerName: "No recruiter assigned" });
    expect(byId(1)).toMatchObject({ ownerId: "ta-busy" });
    expect(team.map((t) => t.recruiterId)).toEqual(["ta-busy"]);
    expect(team[0]).toMatchObject({ openRequisitions: 1, requestedSeats: 2 });
    expect(unassigned).toMatchObject({ requests: 1, requestedSeats: 2 });
  });
});

describe("requisition fulfillment", () => {
  it("counts filled seats from deployments and keeps a recently filled requisition in scope", async () => {
    mocks.mrfFindMany.mockResolvedValue([mrf({ id: 4, status: "FILLED", headcount: 2, deployments: [{ id: 1 }, { id: 2 }] })]);
    const { kpis, requests } = await getAdminDelivery({ range: "7d" });
    expect(requests[0]).toMatchObject({ filled: 2, openSeats: 0, health: "FILLED" });
    expect(kpis).toMatchObject({ requestedSeats: 2, filledSeats: 2, fillRate: null });
    const where = mocks.mrfFindMany.mock.calls[0][0].where.AND[0];
    expect(where.OR[0]).toEqual({ status: "OPEN" });
    expect(where.OR[1]).toMatchObject({ status: "FILLED", deployments: { some: { createdAt: expect.any(Object) } } });
  });

  it("reports requisitions marked FILLED with no deployment behind them instead of counting them as filled", async () => {
    mocks.mrfCount.mockResolvedValue(28);
    const { kpis } = await getAdminDelivery({ range: "7d" });
    expect(kpis.staleFilledRequisitions).toBe(28);
    expect(mocks.mrfCount.mock.calls[0][0].where.AND).toContainEqual({ status: "FILLED", deployments: { none: expect.any(Object) } });
  });
});

describe("overdue counts", () => {
  it("does not call a candidate overdue when no stage change was recorded, and reports them apart", async () => {
    mocks.applicationFindMany.mockResolvedValue([app({ status: "FINAL_INTERVIEW" })]);
    const { kpis, stuck } = await getAdminDelivery({ range: "7d" });
    // The critical count covers the same people as the overdue list, so the headline equals what the Critical filter shows.
    expect(kpis).toMatchObject({ overdueCandidates: 0, overdueEstimated: 1, criticalCandidates: stuck.filter((x) => x.urgency === "critical").length });
    expect(stuck[0]).toMatchObject({ estimated: true, stage: "FINAL_INTERVIEW" });
  });

  it("counts a candidate overdue from a recorded stage change", async () => {
    mocks.decisionGroupBy.mockResolvedValue([decisionInto(1, "FINAL_INTERVIEW")]);
    mocks.applicationFindMany.mockResolvedValue([app({ status: "FINAL_INTERVIEW" })]);
    const { kpis, stuck } = await getAdminDelivery({ range: "7d" });
    expect(kpis).toMatchObject({ overdueCandidates: 1, overdueEstimated: 0, criticalCandidates: 1 });
    expect(stuck[0]).toMatchObject({ estimated: false, urgency: "critical" });
  });

  it("leaves candidates on a closed job out of overdue and reports them as closed openings", async () => {
    mocks.decisionGroupBy.mockResolvedValue([decisionInto(1, "FINAL_INTERVIEW")]);
    mocks.applicationFindMany.mockResolvedValue([app({ status: "FINAL_INTERVIEW" }, { status: "CLOSED" })]);
    const { kpis, stuck } = await getAdminDelivery({ range: "7d" });
    expect(kpis).toMatchObject({ overdueCandidates: 0, closedOpenings: 1 });
    expect(stuck).toHaveLength(0);
  });
});

describe("TA scope", () => {
  it("always uses the signed-in TA, ignoring a recruiterId in the request", async () => {
    await getTADelivery({ range: "7d", recruiterId: "someone-else" }, { role: "TALENT_ACQUISITION", userId: "ta-1" });
    expect(mocks.applicationFindMany.mock.calls[0][0].where.jobPosting).toEqual(own("ta-1"));
    expect(mocks.mrfFindMany.mock.calls[0][0].where.AND).toContainEqual({ assignedTaId: "ta-1" });
    expect(JSON.stringify(mocks.applicationFindMany.mock.calls)).not.toContain("someone-else");
  });

  it("returns the same KPI shape as the admin view", async () => {
    mocks.mrfFindMany.mockResolvedValue([mrf({ assignedTaId: "ta-1" })]);
    const result = await getTADelivery({ range: "7d" }, { role: "TALENT_ACQUISITION", userId: "ta-1" });
    expect(result.kpis).toMatchObject({ requestedSeats: 2, filledSeats: 0, requisitions: { total: 1, open: 1 } });
    expect(result.requests).toHaveLength(1);
    expect(result.clientDecisions).toEqual({ accepted: 0, declined: 0 });
  });
});

describe("client decisions", () => {
  it("counts ENDORSED and APPROVED as accepted and DECLINED as declined", async () => {
    mocks.endorsementGroupBy.mockResolvedValue([
      { outcome: "ENDORSED", _count: { _all: 5 } },
      { outcome: "APPROVED", _count: { _all: 10 } },
      { outcome: "DECLINED", _count: { _all: 2 } },
    ]);
    const { clientDecisions } = await getAdminDelivery({ range: "7d" });
    expect(clientDecisions).toEqual({ accepted: 15, declined: 2 });
  });
});

describe("what needs attention", () => {
  const request = (over: Record<string, unknown>) => mrf({ id: 1, ...over });

  it("tells apart a request with no opening, no applicants, and first-stage applicants only", async () => {
    mocks.mrfFindMany.mockResolvedValue([
      request({ id: 1, _count: { jobPostings: 0 } }),
      request({ id: 2, _count: { jobPostings: 1 } }),
      request({ id: 3, _count: { jobPostings: 1 } }),
      request({ id: 4, _count: { jobPostings: 1 } }),
    ]);
    mocks.applicationFindMany.mockResolvedValue([
      app({ id: 10, status: "REVIEW" }, { mrfId: 3, mrf: { assignedTaId: "ta-busy", status: "OPEN", title: "r", client: { name: "c" } } }),
      app({ id: 11, status: "COMPLIANCE" }, { mrfId: 4, mrf: { assignedTaId: "ta-busy", status: "OPEN", title: "r", client: { name: "c" } } }),
    ]);
    const { requests } = await getAdminDelivery({ range: "7d" });
    const by = Object.fromEntries(requests.map((r) => [r.mrfId, r]));
    expect(by[1]).toMatchObject({ jobCount: 0, attention: "NO_OPENING" });
    expect(by[2]).toMatchObject({ jobCount: 1, applicantCount: 0, attention: "NO_APPLICANTS" });
    expect(by[3]).toMatchObject({ applicantCount: 1, pipeline: 0, attention: "FIRST_STAGE_ONLY" });
    expect(by[4]).toMatchObject({ applicantCount: 1, pipeline: 1, attention: null });
  });

  it("does not flag a filled request", async () => {
    mocks.mrfFindMany.mockResolvedValue([request({ _count: { jobPostings: 0 }, headcount: 1, deployments: [{ id: 1 }] })]);
    const { requests } = await getAdminDelivery({ range: "7d" });
    expect(requests[0]).toMatchObject({ health: "FILLED", attention: null });
  });

  it("counts candidates on openings with no request, so request pipelines are not mistaken for the whole picture", async () => {
    mocks.decisionGroupBy.mockResolvedValue([decisionInto(1, "FINAL_INTERVIEW")]);
    mocks.applicationFindMany.mockResolvedValue([app({ status: "FINAL_INTERVIEW" })]);
    const { kpis } = await getAdminDelivery({ range: "7d" });
    expect(kpis.unlinkedApplicants).toBe(1);
  });

  it("gives a TA their own overdue list, with no other recruiter's name on it", async () => {
    mocks.decisionGroupBy.mockResolvedValue([decisionInto(1, "FINAL_INTERVIEW")]);
    mocks.applicationFindMany.mockResolvedValue([
      app({ status: "FINAL_INTERVIEW" }, { postedById: "ta-1", mrf: { assignedTaId: "ta-1", status: "OPEN", title: "r", client: { name: "c" } }, mrfId: 5 }),
    ]);
    const { stuck, stuckTotal } = await getTADelivery({ range: "7d" }, { role: "TALENT_ACQUISITION", userId: "ta-1" });
    expect(stuckTotal).toBe(1);
    expect(stuck[0]).toMatchObject({ recruiterName: "You", urgency: "critical", estimated: false });
  });

  it("returns every overdue candidate to a report, even past the dashboard cap", async () => {
    mocks.applicationFindMany.mockResolvedValue(Array.from({ length: 230 }, (_, i) => app({ id: i + 1, status: "FINAL_INTERVIEW" })));
    const { result, detail } = await getAdminReportData({ range: "7d" });
    expect(result.stuck).toHaveLength(200);
    expect(result.stuckTotal).toBe(230);
    expect(detail.overdue).toHaveLength(230);
    expect(detail.candidates).toHaveLength(230);
  });
});
