import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../utils/prisma.js", () => ({
  default: {
    client: { findFirst: vi.fn().mockResolvedValue(null) },
    manpowerRequest: { findFirst: vi.fn().mockResolvedValue(null) },
    jobPosting: { findFirst: vi.fn().mockResolvedValue(null) },
    user: { findFirst: vi.fn().mockResolvedValue(null) },
    application: { findMany: vi.fn().mockResolvedValue([]) },
    deployment: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("./delivery.service.js", async () => {
  const actual = await vi.importActual<typeof import("./delivery.service.js")>("./delivery.service.js");
  return { ...actual, getAdminReportData: vi.fn(), getTAReportData: vi.fn() };
});

import { __reportModels } from "./export.service.js";
import { getAdminReportData, getTAReportData } from "./delivery.service.js";
import { METRICS, STAGE_ROWS, backoutReasonLabel } from "./metric-definitions.js";

const OLD_LABELS = ["Slots filled", "Usual days to fill", "Workers who started", "Withdrew before client review"];
const DEPLOYMENT_ONLY = ["Seats still open", "Hired, waiting to start"];
const allowedLabels = [...Object.values(METRICS).map((m) => m.label), ...DEPLOYMENT_ONLY];

const kpis = (over: Record<string, unknown> = {}) => ({
  fillRate: 50,
  filledSeats: 5,
  requestedSeats: 10,
  openSeats: 5,
  requisitions: { total: 3, open: 2, overdue: 1, atRisk: 0, filled: 1 },
  placementsStarted: 6,
  newStarts: 4,
  redeployStarts: 2,
  medianDaysToFill: 12,
  daysToFillSample: 6,
  backoutsAfterClientReview: 1,
  backoutRate: 14.3,
  backoutRateBase: 7,
  activeApplicants: 20,
  overdueCandidates: 3,
  overdueEstimated: 2,
  overdueTotal: 5,
  lateRequests: 1,
  closedOpenings: 0,
  criticalCandidates: 1,
  unlinkedApplicants: 0,
  staleFilledRequisitions: 0,
  ...over,
});

const request = (over: Record<string, unknown> = {}) => ({
  mrfId: 1,
  title: "Cashiers",
  clientId: 1,
  clientName: "Acme",
  status: "OPEN",
  ownerId: "ta-1",
  ownerName: "Ana TA",
  headcount: 4,
  filled: 1,
  openSeats: 3,
  pipeline: 2,
  overdueCandidates: 0,
  jobCount: 1,
  applicantCount: 2,
  attention: null,
  targetFillDate: null,
  daysRemaining: null,
  health: "OVERDUE",
  backoutsInPeriod: 0,
  ...over,
});

const stageRow = (stage: string, label: string, over: Record<string, unknown> = {}) => ({
  stage,
  label,
  inStageNow: 6,
  overdue: 1,
  overdueEstimated: 0,
  entered: 8,
  backedOut: 0,
  avgDaysInStage: 3.5,
  medianDaysInStage: 3,
  typicalWaitSample: 6,
  slaDays: 7,
  ...over,
});

const teamRow = (over: Record<string, unknown> = {}) => ({
  recruiterId: "ta-1",
  name: "Ana TA",
  active: 4,
  overdue: 0,
  overdueEstimated: 0,
  openRequisitions: 1,
  requestedSeats: 8,
  filledSeats: 2,
  fillRate: 25,
  sentToClient: 3,
  newStarts: 1,
  redeployStarts: 0,
  placed: 1,
  backouts: 1,
  backoutRate: null,
  backoutRateBase: 3,
  medianDaysToFill: null,
  daysToFillSample: 2,
  ...over,
});

function adminData(kpiOver: Record<string, unknown> = {}) {
  return {
    result: {
      kpis: kpis(kpiOver),
      requests: [request({ ownerId: null, ownerName: "No recruiter assigned" }), request({ mrfId: 2, health: "ON_TRACK" })],
      stageTable: STAGE_ROWS.map((r) => stageRow(r.key, r.label)),
      team: [teamRow()],
      backouts: { withdrawals: 2, backouts: 1, noShows: 1 },
      closures: {
        rejected: { total: 0, talentPool: 0, archive: 0, notRecorded: 0 },
        backedOut: { total: 0, talentPool: 0, archive: 0, notRecorded: 0 },
        topRejectionReasons: [],
        rejectedByStage: [],
      },
    },
    detail: {
      candidates: [],
      starts: [],
      overdue: [],
      overdueTotal: 0,
      backouts: [
        {
          occurredAt: new Date("2026-10-10T00:00:00Z"),
          stage: "COMPLIANCE",
          candidateName: "Juan",
          jobTitle: "Cashier",
          clientName: "Acme",
          mrfTitle: "Cashiers",
          party: "APPLICANT",
          reason: "ACCEPTED_OTHER_OFFER",
          notes: null,
          recordedBy: "Ana",
          recruiterName: "Ana TA",
        },
      ],
    },
  };
}

const admin = { id: "admin-1", email: "admin@megs.ph", role: "ADMINISTRATOR" };

beforeEach(() => {
  vi.mocked(getAdminReportData).mockReset();
  vi.mocked(getTAReportData).mockReset();
});

const sectionNamed = (model: { sections: { sheet: string }[] }, sheet: string) => model.sections.find((s) => s.sheet === sheet) as any;

describe("report models use the screen's words", () => {
  it("every KPI label comes from METRICS, in both models", async () => {
    vi.mocked(getAdminReportData).mockResolvedValue(adminData() as any);
    for (const model of [await __reportModels.buildPipelineModel(admin, {}), await __reportModels.buildDeploymentModel(admin, {})]) {
      for (const k of model.kpis) {
        expect(allowedLabels).toContain(k.label);
        expect(OLD_LABELS).not.toContain(k.label);
        expect(["Right now", "In these dates"]).toContain(k.basis);
        expect(k.definition.length).toBeGreaterThan(0);
      }
    }
  });

  it("backed out after client review is a count; the rate has its own KPI", async () => {
    vi.mocked(getAdminReportData).mockResolvedValue(adminData() as any);
    const model = await __reportModels.buildPipelineModel(admin, {});
    const count = model.kpis.find((k) => k.label === METRICS.backoutsAfterClientReview.label)!;
    const rate = model.kpis.find((k) => k.label === METRICS.backoutRate.label)!;
    expect(count.value).toBe(1);
    expect(rate.value).toBe("14.3%");
    expect(model.kpis.filter((k) => k.label === "Backed out after client review")).toHaveLength(1);
  });

  it("prints Not enough data (n=N) when a rate is null, in both models", async () => {
    vi.mocked(getAdminReportData).mockResolvedValue(adminData({ backoutRate: null, backoutRateBase: 3, fillRate: null, requestedSeats: 4, medianDaysToFill: null, daysToFillSample: 2 }) as any);
    const pipeline = await __reportModels.buildPipelineModel(admin, {});
    const deployment = await __reportModels.buildDeploymentModel(admin, {});
    for (const model of [pipeline, deployment]) {
      expect(model.kpis.find((k) => k.label === METRICS.backoutRate.label)!.value).toBe("No data yet");
    }
    expect(deployment.kpis.find((k) => k.label === METRICS.seatsFilled.label)!.value).toBe("No data yet");
    expect(deployment.kpis.find((k) => k.label === METRICS.daysToFill.label)!.value).toBe("No data yet");
    const text = JSON.stringify([pipeline.kpis, deployment.kpis]);
    expect(text).not.toContain("null");
  });

  it("prints No recruiter assigned for a request with no owner", async () => {
    vi.mocked(getAdminReportData).mockResolvedValue(adminData() as any);
    const model = await __reportModels.buildPipelineModel(admin, {});
    const rows = sectionNamed(model, "Client requests").rows;
    expect(rows[0].owner).toBe("No recruiter assigned");
    expect(rows[0].status).toBe("Overdue");
    expect(rows[1].status).toBe("On track");
  });

  it("uses screen stage labels and backout reason labels", async () => {
    vi.mocked(getAdminReportData).mockResolvedValue(adminData() as any);
    const model = await __reportModels.buildPipelineModel(admin, {});
    const stages = sectionNamed(model, "Candidates by stage");
    expect(stages.rows.map((r: any) => r.stage)).toEqual(STAGE_ROWS.map((r) => r.label));
    const backouts = sectionNamed(model, "Why people backed out").rows;
    expect(backouts[0].reason).toBe(backoutReasonLabel("ACCEPTED_OTHER_OFFER"));
    expect(backouts[0].type).toBe("Backed out after client review");
  });

  it("shows Not enough data in the stage table when the wait rests on few candidates", async () => {
    const data = adminData();
    data.result.stageTable[1] = stageRow("INITIAL_SCREENING", "Initial screening", { typicalWaitSample: 2, medianDaysInStage: null, avgDaysInStage: null }) as any;
    vi.mocked(getAdminReportData).mockResolvedValue(data as any);
    const model = await __reportModels.buildPipelineModel(admin, {});
    const row = sectionNamed(model, "Candidates by stage").rows[1];
    expect(row.median).toBe("No data yet");
    expect(row.avg).toBe("No data yet");
  });

  it("recruiters sheet prints Not enough data instead of 0 for a null rate", async () => {
    vi.mocked(getAdminReportData).mockResolvedValue(adminData() as any);
    const model = await __reportModels.buildPipelineModel(admin, {});
    const row = sectionNamed(model, "Recruiters").rows[0];
    expect(row.backoutRate).toBe("No data yet");
    expect(row.days).toBe("No data yet");
    expect(row.fill).toBe(25);
  });
  it("no column header or note uses a retired word", async () => {
    vi.mocked(getAdminReportData).mockResolvedValue(adminData() as any);
    const retired = /step|within the dates|withdrawals|slots/i;
    for (const model of [await __reportModels.buildPipelineModel(admin, {}), await __reportModels.buildDeploymentModel(admin, {})]) {
      for (const s of model.sections) {
        for (const text of [s.title, s.sheet, s.note ?? "", ...s.columns.map((c) => c.header)]) expect(text).not.toMatch(retired);
        const cells = s.rows.flatMap((r: any) => Object.values(r)).filter((v): v is string => typeof v === "string");
        for (const text of cells) expect(text).not.toMatch(/Sure|Returning|Job post/);
      }
    }
  });
});
