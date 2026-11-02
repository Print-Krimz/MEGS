import { describe, expect, it, vi } from "vitest";

vi.mock("../../utils/prisma.js", () => ({ default: {} }));

import {
  buildDropOff,
  buildKpis,
  buildStageTable,
  buildTrend,
  buildJobClause,
  summarizeBackouts,
  summarizeClosures,
} from "./delivery.service.js";
import {
  BACKOUT_REASON_LABELS,
  METRICS,
  MIN_SAMPLE,
  STAGE_ROWS,
  latestAttemptOnly,
  manilaDayDiff,
  manilaWeekStart,
  median,
  percent,
  recentWeekStarts,
  requestHealth,
  stageEnteredAt,
  stageEntry,
  stagesReached,
  trendBucketStarts,
  trendGranularity,
  sampled,
  urgencyFor,
  type MetricKey,
} from "./metric-definitions.js";

const d = (iso: string) => new Date(iso);

describe("metric definitions", () => {
  it("counts a returning applicant once, using the latest attempt", () => {
    const apps = [
      { userId: "u1", jobPostingId: 1, attemptNumber: 1, createdAt: d("2026-09-01T00:00:00Z") },
      { userId: "u1", jobPostingId: 1, attemptNumber: 2, createdAt: d("2026-10-01T00:00:00Z") },
      { userId: "u2", jobPostingId: 1, attemptNumber: 1, createdAt: d("2026-10-02T00:00:00Z") },
    ];
    const result = latestAttemptOnly(apps);
    expect(result).toHaveLength(2);
    expect(result.find((a) => a.userId === "u1")!.attemptNumber).toBe(2);
  });

  it("does not count skipped stages or reverted moves as reached", () => {
    // Fast track: INITIAL_SCREENING straight to COMPLIANCE
    const reached = stagesReached("COMPLIANCE", [
      { fromStatus: "SUBMITTED", toStatus: "INITIAL_SCREENING", createdAt: d("2026-10-01T00:00:00Z") },
      { fromStatus: "INITIAL_SCREENING", toStatus: "COMPLIANCE", createdAt: d("2026-10-02T00:00:00Z") },
      { fromStatus: "COMPLIANCE", toStatus: "CONTRACT_SIGNING", createdAt: d("2026-10-03T00:00:00Z"), isReverted: true },
    ]);
    expect([...reached].sort()).toEqual(["APPLIED", "COMPLIANCE", "INITIAL_SCREENING"]);
    expect(reached.has("CLIENT_ENDORSEMENT")).toBe(false);
    expect(reached.has("FINAL_INTERVIEW")).toBe(false);
    expect(reached.has("CONTRACT_SIGNING")).toBe(false);
  });

  it("uses the latest non-reverted decision as the stage entry time", () => {
    const entered = stageEnteredAt(
      [
        { fromStatus: "A", toStatus: "COMPLIANCE", createdAt: d("2026-10-01T00:00:00Z") },
        { fromStatus: "A", toStatus: "COMPLIANCE", createdAt: d("2026-10-05T00:00:00Z"), isReverted: true },
        { fromStatus: "A", toStatus: "COMPLIANCE", createdAt: d("2026-10-03T00:00:00Z") },
      ],
      "COMPLIANCE",
      d("2026-09-01T00:00:00Z")
    );
    expect(entered).toEqual(d("2026-10-03T00:00:00Z"));
  });

  it("assigns weeks by Manila time: 02:00 PHT Monday belongs to that Monday, not the previous week", () => {
    // 2026-10-12 is a Monday. 02:00 PHT = 2026-10-11T18:00:00Z (Sunday in UTC).
    expect(manilaWeekStart(d("2026-10-11T18:00:00Z"))).toBe("2026-10-12");
    expect(manilaWeekStart(d("2026-10-18T15:59:00Z"))).toBe("2026-10-12"); // Sunday 23:59 PHT
    expect(manilaWeekStart(d("2026-10-18T16:00:00Z"))).toBe("2026-10-19"); // Monday 00:00 PHT
  });

  it("lists 12 week starts ending with the current week", () => {
    const weeks = recentWeekStarts(12, d("2026-10-14T05:00:00Z"));
    expect(weeks).toHaveLength(12);
    expect(weeks[11]).toBe("2026-10-12");
    expect(weeks[0]).toBe("2026-07-27");
  });

  it("is safe with no data", () => {
    expect(median([])).toBeNull();
    expect(percent(0, 0)).toBe(0);
  });

  describe("request health", () => {
    const now = d("2026-10-13T00:00:00Z");
    const base = { headcount: 10, filled: 4, pipeline: 3, now };
    it("FILLED when filled seats reach the headcount", () => {
      expect(requestHealth({ ...base, filled: 10, targetFillDate: d("2026-10-01T00:00:00Z") })).toBe("FILLED");
    });
    it("OVERDUE once the target date has passed", () => {
      expect(requestHealth({ ...base, targetFillDate: d("2026-10-12T00:00:00Z") })).toBe("OVERDUE");
    });
    it("AT_RISK within 7 days when the pipeline cannot cover the open seats", () => {
      expect(requestHealth({ ...base, targetFillDate: d("2026-10-20T00:00:00Z") })).toBe("AT_RISK");
      expect(requestHealth({ ...base, targetFillDate: d("2026-10-21T00:00:00Z") })).toBe("ON_TRACK"); // 8 Manila days away
    });
    it("ON_TRACK when the pipeline covers the open seats", () => {
      expect(requestHealth({ ...base, pipeline: 6, targetFillDate: d("2026-10-15T00:00:00Z") })).toBe("ON_TRACK");
    });
    it("ON_TRACK without a target date", () => {
      expect(requestHealth({ ...base, targetFillDate: null })).toBe("ON_TRACK");
    });
  });
});

describe("closed applications", () => {
  const closure = (over: Record<string, unknown>) => ({
    outcome: "REJECTED" as const,
    disposition: "ARCHIVE" as const,
    stage: "INITIAL_SCREENING",
    reasonCode: "QUALIFICATIONS_MISMATCH",
    ...over,
  });

  it("keeps Rejected and Backed Out apart and splits each by disposition", () => {
    const s = summarizeClosures([
      closure({}),
      closure({ disposition: "TALENT_POOL", reasonCode: "CLIENT_DECLINED" }),
      closure({ outcome: "BACKED_OUT", reasonCode: "FAMILY_OR_PERSONAL" }),
      closure({ outcome: "BACKED_OUT", disposition: null, reasonCode: "NO_SHOW" }),
    ]);
    expect(s.rejected).toEqual({ total: 2, talentPool: 1, archive: 1, notRecorded: 0 });
    expect(s.backedOut).toEqual({ total: 2, talentPool: 0, archive: 1, notRecorded: 1 });
  });

  it("lists rejection reasons and stages for rejections only", () => {
    const s = summarizeClosures([
      closure({}),
      closure({}),
      closure({ reasonCode: "FAILED_FINAL_INTERVIEW", stage: "FINAL_INTERVIEW" }),
      closure({ outcome: "BACKED_OUT", reasonCode: "HEALTH" }),
    ]);
    expect(s.topRejectionReasons).toEqual([
      { reason: "QUALIFICATIONS_MISMATCH", count: 2 },
      { reason: "FAILED_FINAL_INTERVIEW", count: 1 },
    ]);
    expect(s.rejectedByStage.map((r) => [r.stage, r.count])).toEqual([["INITIAL_SCREENING", 2], ["FINAL_INTERVIEW", 1]]);
  });

  it("is empty when nothing was closed", () => {
    const s = summarizeClosures([]);
    expect(s.rejected.total).toBe(0);
    expect(s.backedOut.total).toBe(0);
    expect(s.topRejectionReasons).toEqual([]);
  });
});

describe("drop-off", () => {
  const dec = (from: string, to: string, day: number, isReverted = false) => ({
    fromStatus: from,
    toStatus: to,
    createdAt: d(`2026-10-${String(day).padStart(2, "0")}T00:00:00Z`),
    isReverted,
  });

  const apps = [
    // Still at client review
    { status: "CLIENT_ENDORSEMENT", decisions: [dec("SUBMITTED", "INITIAL_SCREENING", 1), dec("INITIAL_SCREENING", "CLIENT_ENDORSEMENT", 2)] },
    // Backed out at requirements (recorded)
    {
      status: "BACKOUT",
      backoutStage: "COMPLIANCE",
      decisions: [dec("SUBMITTED", "INITIAL_SCREENING", 1), dec("INITIAL_SCREENING", "COMPLIANCE", 3), dec("COMPLIANCE", "BACKOUT", 4)],
    },
    // Rejected at initial review
    { status: "ARCHIVED", decisions: [dec("SUBMITTED", "INITIAL_SCREENING", 1), dec("INITIAL_SCREENING", "ARCHIVED", 2)] },
    // Never moved
    { status: "SUBMITTED", decisions: [] },
  ];

  it("counts a REJECTED application as rejected at the stage it left, not as still in the pipeline", () => {
    const out = Object.fromEntries(
      buildDropOff([{ status: "REJECTED", decisions: [dec("SUBMITTED", "INITIAL_SCREENING", 1), dec("INITIAL_SCREENING", "REJECTED", 2)] }]).map((r) => [r.stage, r])
    );
    expect(out.INITIAL_SCREENING.rejected).toBe(1);
    expect(out.INITIAL_SCREENING.inStage).toBe(0);
    expect(out.INITIAL_SCREENING.backedOut).toBe(0);
  });
  const rows = Object.fromEntries(buildDropOff(apps).map((r) => [r.stage, r]));

  it("counts every application in the first row", () => {
    expect(rows.APPLIED.reached).toBe(4);
    expect(rows.APPLIED.inStage).toBe(1);
  });
  it("reaches initial review once per application", () => {
    expect(rows.INITIAL_SCREENING.reached).toBe(3);
    expect(rows.INITIAL_SCREENING.rejected).toBe(1);
    expect(rows.INITIAL_SCREENING.movedForward).toBe(2);
  });
  it("does not credit the fast-tracked application with the client review stage", () => {
    expect(rows.CLIENT_ENDORSEMENT.reached).toBe(1);
    expect(rows.CLIENT_ENDORSEMENT.inStage).toBe(1);
  });
  it("counts a backfilled backout (record present, status still ARCHIVED) as a backout, not a rejection", () => {
    const [applied, , , , compliance] = buildDropOff([
      {
        status: "ARCHIVED",
        backoutStage: "COMPLIANCE",
        decisions: [dec("SUBMITTED", "INITIAL_SCREENING", 1), dec("INITIAL_SCREENING", "COMPLIANCE", 3), dec("COMPLIANCE", "ARCHIVED", 4)],
      },
    ]);
    expect(applied.reached).toBe(1);
    expect(compliance).toMatchObject({ reached: 1, backedOut: 1, rejected: 0 });
  });

  it("records the backout at the stage where it happened", () => {
    expect(rows.COMPLIANCE.reached).toBe(1);
    expect(rows.COMPLIANCE.backedOut).toBe(1);
    expect(rows.COMPLIANCE.movedForward).toBe(0);
  });
});

describe("stage table", () => {
  const snap = (stage: string, daysInStage: number, overdue: boolean, overdueEstimated = false) => ({
    applicationId: 1, candidateName: "x", jobTitle: "y", mrfId: null, clientName: null, ownerId: "r",
    stage: stage as any, daysInStage, slaDays: 5, overdue, overdueEstimated, closedOpening: false,
  });
  it("counts in-stage, overdue, entered and backed out per stage", () => {
    const table = buildStageTable(
      [snap("COMPLIANCE", 10, true), snap("COMPLIANCE", 2, false)],
      new Map([["COMPLIANCE", 3]]) as any,
      [
        { applicationId: 9, stage: "COMPLIANCE", party: "CLIENT", reason: "CLIENT_CANCELLED_REQUEST", occurredAt: d("2026-10-10T00:00:00Z"), candidateName: "a", jobTitle: "b", clientName: null, mrfId: null, ownerId: "r" },
      ]
    );
    const row = table.find((r) => r.stage === "COMPLIANCE")!;
    expect(row).toMatchObject({ inStageNow: 2, overdue: 1, entered: 3, backedOut: 1, avgDaysInStage: null, medianDaysInStage: null, typicalWaitSample: 2 });
    expect(table.find((r) => r.stage === "FINAL_INTERVIEW")).toMatchObject({ inStageNow: 0, avgDaysInStage: null, medianDaysInStage: null });
  });
  it("reports estimated overdue separately from overdue", () => {
    const table = buildStageTable([snap("FINAL_INTERVIEW", 30, false, true), snap("FINAL_INTERVIEW", 9, true)], new Map(), []);
    expect(table.find((r) => r.stage === "FINAL_INTERVIEW")).toMatchObject({ overdue: 1, overdueEstimated: 1 });
  });
});

describe("backout summary", () => {
  const rec = (stage: string, party: any, reason: string, day: number) => ({
    applicationId: day, stage, party, reason, occurredAt: d(`2026-10-${String(day).padStart(2, "0")}T00:00:00Z`),
    candidateName: "n", jobTitle: "j", clientName: null, mrfId: null, ownerId: "r",
  });
  const summary = summarizeBackouts([
    rec("SUBMITTED", "APPLICANT", "OTHER", 5),
    rec("COMPLIANCE", "APPLICANT", "ACCEPTED_OTHER_OFFER", 4),
    rec("COMPLIANCE", "CLIENT", "CLIENT_CANCELLED_REQUEST", 3),
    rec("DEPLOYED", "APPLICANT", "ACCEPTED_OTHER_OFFER", 2),
  ]);
  it("separates withdrawals (before client review) from backouts (after)", () => {
    expect(summary.withdrawals).toBe(1);
    expect(summary.backouts).toBe(3);
  });
  it("splits by party and ranks reasons", () => {
    expect(summary.byParty).toEqual({ APPLICANT: 3, CLIENT: 1, AGENCY: 0 });
    expect(summary.topReasons[0]).toEqual({ reason: "ACCEPTED_OTHER_OFFER", count: 2, label: "Accepted another job offer" });
  });
  it("has stage rows whose totals add up to all backouts", () => {
    expect(summary.byStage.reduce((s, r) => s + r.total, 0)).toBe(4);
  });

  it("counts no-shows on their own and ranks clients and requests", () => {
    const withDetail = (day: number, reason: string, client: string | null, mrfId: number | null, title: string | null) => ({
      ...rec("COMPLIANCE", "APPLICANT", reason, day), clientName: client, mrfId, mrfTitle: title,
    });
    const detailed = summarizeBackouts([
      withDetail(1, "NO_SHOW", "Acme", 7, "10x Electricians"),
      withDetail(2, "NO_SHOW", "Acme", 7, "10x Electricians"),
      withDetail(3, "OTHER", "Beta", 8, "5x Welders"),
      withDetail(4, "OTHER", null, null, null),
    ]);
    expect(detailed.noShows).toBe(2);
    expect(detailed.byClient).toEqual([
      { clientName: "Acme", count: 2 },
      { clientName: "Beta", count: 1 },
      { clientName: "No client", count: 1 },
    ]);
    expect(detailed.byRequest).toEqual([
      { mrfId: 7, title: "10x Electricians", clientName: "Acme", count: 2 },
      { mrfId: 8, title: "5x Welders", clientName: "Beta", count: 1 },
    ]);
  });
});

describe("admin kpis and trend chart", () => {
  const placement = (daysToFill: number | null, isRedeployment: boolean, hasApplication = true) => ({ daysToFill, isRedeployment, hasApplication });

  it("fill rate caps over-filled requests; new and redeploy starts are separate", () => {
    const kpis = buildKpis(
      [
        { headcount: 10, filled: 12, health: "FILLED" },
        { headcount: 10, filled: 4, health: "ON_TRACK" },
      ],
      [placement(10, false), placement(20, true), placement(null, false, false)],
      1
    );
    expect(kpis).toMatchObject({
      requestedSeats: 20,
      filledSeats: 14,
      openSeats: 6,
      fillRate: 70,
      placementsStarted: 3,
      newStarts: 2,
      redeployStarts: 1,
      medianDaysToFill: null,
      daysToFillSample: 2,
      requisitions: { total: 2, open: 1, filled: 1, overdue: 0, atRisk: 0 },
    });
  });

  it("backout rate counts only starts that came through an application, and exposes the base", () => {
    const kpis = buildKpis([], [placement(5, false), placement(5, true), placement(null, true, false)], 1);
    // 1 backout out of 1 backout + 2 starts from an application; the direct redeployment has no application to back out of
    expect(kpis).toMatchObject({ backoutsAfterClientReview: 1, backoutRateBase: 3, backoutRate: null });
  });

  it("counts overdue from recorded stage changes, keeps estimated ones apart, and leaves closed openings out", () => {
    const item = (o: Partial<{ stage: any; overdue: boolean; overdueEstimated: boolean; closedOpening: boolean }>) => ({
      stage: "COMPLIANCE", overdue: false, overdueEstimated: false, closedOpening: false, ...o,
    });
    const kpis = buildKpis(
      [],
      [],
      0,
      [item({ overdue: true }), item({ overdueEstimated: true }), item({ closedOpening: true }), item({ stage: "DEPLOYED", overdue: true })],
      2
    );
    expect(kpis).toMatchObject({ activeApplicants: 3, overdueCandidates: 1, overdueEstimated: 1, closedOpenings: 1, staleFilledRequisitions: 2 });
  });

  it("is zero-safe with no requests, placements or backouts", () => {
    expect(buildKpis([], [], 0)).toMatchObject({ fillRate: null, openSeats: 0, backoutRate: null, medianDaysToFill: null, daysToFillSample: 0 });
  });

  it("buckets the trend by week for a 30 day range and separates new, redeploy, backout and withdrawal", () => {
    const start = d("2026-09-14T16:00:00Z"); // 15 Sep 00:00 Manila
    const end = d("2026-10-14T15:59:59Z");
    const trend = buildTrend(
      [
        { startedAt: d("2026-10-11T18:00:00Z"), isRedeployment: false }, // Monday 12 Oct 02:00 Manila
        { startedAt: d("2026-10-05T02:00:00Z"), isRedeployment: false },
        { startedAt: d("2026-10-05T03:00:00Z"), isRedeployment: true },
        { startedAt: d("2020-01-01T00:00:00Z"), isRedeployment: false }, // outside the range
      ],
      [
        { occurredAt: d("2026-10-13T00:00:00Z"), stage: "COMPLIANCE" },
        { occurredAt: d("2026-10-13T00:00:00Z"), stage: "SUBMITTED" },
      ],
      start,
      end,
      30
    );
    expect(trend.granularity).toBe("week");
    expect(trend.points.map((p) => p.start)).toEqual(["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"]);
    expect(trend.points[3]).toMatchObject({ newStarts: 1, redeployStarts: 1 });
    expect(trend.points[4]).toMatchObject({ newStarts: 1, backouts: 1, withdrawals: 1 });
    expect(trend.points.reduce((s, p) => s + p.newStarts + p.redeployStarts, 0)).toBe(3);
  });

  it("uses day buckets for short ranges and month buckets for long ones", () => {
    expect(trendGranularity(7)).toBe("day");
    expect(trendGranularity(30)).toBe("week");
    expect(trendGranularity(200)).toBe("month");
    expect(trendBucketStarts(d("2026-10-07T16:00:00Z"), d("2026-10-14T15:59:59Z"), "day")).toHaveLength(7);
    expect(trendBucketStarts(d("2026-07-31T16:00:00Z"), d("2026-10-14T15:59:59Z"), "month")).toEqual(["2026-08-01", "2026-09-01", "2026-10-01"]);
  });
});

describe("days and stage entry", () => {
  it("counts Manila calendar days, so a same-day start is 0 and an earlier start is negative", () => {
    expect(manilaDayDiff(d("2026-10-12T15:59:10Z"), d("2026-10-12T08:00:00Z"))).toBe(0); // both on 12 Oct in Manila
    expect(manilaDayDiff(d("2026-10-10T02:00:00Z"), d("2026-10-14T02:00:00Z"))).toBe(4);
    expect(manilaDayDiff(d("2026-10-14T02:00:00Z"), d("2026-10-10T02:00:00Z"))).toBe(-4);
  });

  it("marks stage entry as estimated when a later stage has no recorded change", () => {
    const decisions = [{ fromStatus: "INITIAL_SCREENING", toStatus: "FINAL_INTERVIEW", createdAt: d("2026-10-01T00:00:00Z") }];
    expect(stageEntry(decisions, "FINAL_INTERVIEW", d("2026-09-01T00:00:00Z"))).toEqual({ at: d("2026-10-01T00:00:00Z"), estimated: false });
    expect(stageEntry([], "FINAL_INTERVIEW", d("2026-09-01T00:00:00Z"))).toEqual({ at: d("2026-09-01T00:00:00Z"), estimated: true });
    expect(stageEntry([], "SUBMITTED", d("2026-09-01T00:00:00Z")).estimated).toBe(false); // the first stage starts at creation
  });

  it("calls a candidate critical after twice the stage limit", () => {
    expect(urgencyFor(9, 5)).toBe("overdue");
    expect(urgencyFor(10, 5)).toBe("critical");
  });
});

describe("job scope", () => {
  const own = (id: string) => ({ OR: [{ mrf: { is: { assignedTaId: id } } }, { mrfId: null, postedById: id }] });
  const scope = { role: "TALENT_ACQUISITION", userId: "ta-1" };

  it("always limits a TA to the jobs they own, ignoring mineOnly and recruiterId", () => {
    expect(buildJobClause({}, scope)).toEqual(own("ta-1"));
    expect(buildJobClause({ mineOnly: false }, scope)).toEqual(own("ta-1"));
    expect(buildJobClause({ recruiterId: "ta-2", mineOnly: false }, scope)).toEqual(own("ta-1"));
  });
  it("lets admin filter by recruiter and combines client and MRF filters", () => {
    expect(buildJobClause({ recruiterId: "ta-2", clientId: 4, mrfId: 9 })).toEqual({
      ...own("ta-2"),
      mrfId: 9,
      mrf: { clientId: 4 },
    });
  });
  it("gives admin everything when no recruiter is chosen", () => {
    expect(buildJobClause({})).toEqual({});
  });
});

describe("five-case rule and named definitions", () => {
  const placement = (daysToFill: number | null, isRedeployment = false, hasApplication = true) => ({ daysToFill, isRedeployment, hasApplication });
  const many = (n: number, daysToFill: number | null = 5) => Array.from({ length: n }, () => placement(daysToFill));

  it("sampled hides a value under five cases", () => {
    expect(MIN_SAMPLE).toBe(5);
    expect(sampled(10, 4)).toBeNull();
    expect(sampled(10, 5)).toBe(10);
    expect(sampled(null, 9)).toBeNull();
  });

  it("backout rate is null under five cases and a number from five", () => {
    const four = buildKpis([], many(3), 1);
    expect(four).toMatchObject({ backoutRate: null, backoutRateBase: 4 });
    const five = buildKpis([], many(4), 1);
    expect(five.backoutRateBase).toBe(5);
    expect(five.backoutRate).toBe(20);
  });

  it("days to fill is null under five fill times and a number from five", () => {
    expect(buildKpis([], many(4), 0)).toMatchObject({ medianDaysToFill: null, daysToFillSample: 4 });
    expect(buildKpis([], many(5), 0)).toMatchObject({ medianDaysToFill: 5, daysToFillSample: 5 });
  });

  it("fill rate is null under five requested seats but the counts stay", () => {
    const kpis = buildKpis([{ headcount: 4, filled: 2, health: "ON_TRACK" }], [], 0);
    expect(kpis).toMatchObject({ fillRate: null, filledSeats: 2, requestedSeats: 4 });
    expect(buildKpis([{ headcount: 5, filled: 2, health: "ON_TRACK" }], [], 0).fillRate).toBe(40);
  });

  it("overdueTotal adds verified and estimated; lateRequests adds overdue and at-risk", () => {
    const item = (o: object) => ({ stage: "COMPLIANCE" as const, overdue: false, overdueEstimated: false, closedOpening: false, ...o });
    const snapshot = [item({ overdue: true }), item({ overdue: true }), item({ overdueEstimated: true }), item({ overdueEstimated: true }), item({ overdueEstimated: true })];
    const reqs = [
      { headcount: 1, filled: 0, health: "OVERDUE" as const },
      { headcount: 1, filled: 0, health: "AT_RISK" as const },
      { headcount: 1, filled: 0, health: "AT_RISK" as const },
      { headcount: 1, filled: 0, health: "ON_TRACK" as const },
    ];
    const kpis = buildKpis(reqs, [], 0, snapshot);
    expect(kpis.overdueTotal).toBe(5);
    expect(kpis.lateRequests).toBe(3);
  });

  it("stage table hides the typical wait under five candidates and reports the sample", () => {
    const snap = (days: number) => ({
      applicationId: 1, candidateName: "x", jobTitle: "y", mrfId: null, clientName: null, ownerId: "r",
      stage: "COMPLIANCE" as any, daysInStage: days, slaDays: 5, overdue: false, overdueEstimated: false, closedOpening: false,
    });
    const four = buildStageTable([1, 2, 3, 4].map(snap), new Map(), []).find((r) => r.stage === "COMPLIANCE")!;
    expect(four).toMatchObject({ medianDaysInStage: null, avgDaysInStage: null, typicalWaitSample: 4 });
    const five = buildStageTable([1, 2, 3, 4, 5].map(snap), new Map(), []).find((r) => r.stage === "COMPLIANCE")!;
    expect(five).toMatchObject({ medianDaysInStage: 3, avgDaysInStage: 3, typicalWaitSample: 5 });
  });

  it("backout summary adds readable reason labels", () => {
    const rec = (reason: string, day: number) => ({
      applicationId: day, stage: "COMPLIANCE", party: "APPLICANT" as const, reason, occurredAt: d(`2026-10-${String(day).padStart(2, "0")}T00:00:00Z`),
      candidateName: "n", jobTitle: "j", clientName: null, mrfId: null, ownerId: "r",
    });
    const s = summarizeBackouts([rec("NO_SHOW", 1), rec("NO_SHOW", 2), rec("SALARY_OR_BENEFITS", 3)]);
    expect(s.topReasons[0]).toEqual({ reason: "NO_SHOW", count: 2, label: BACKOUT_REASON_LABELS.NO_SHOW });
    expect(s.recent[0].reasonLabel).toBeTruthy();
    expect(s.recent.find((r) => r.reason === "SALARY_OR_BENEFITS")!.reasonLabel).toBe("Salary or benefits");
  });

  it("trend points carry total starts", () => {
    const trend = buildTrend(
      [
        { startedAt: d("2026-10-05T02:00:00Z"), isRedeployment: false },
        { startedAt: d("2026-10-05T03:00:00Z"), isRedeployment: false },
        { startedAt: d("2026-10-05T04:00:00Z"), isRedeployment: true },
      ],
      [],
      d("2026-09-14T16:00:00Z"),
      d("2026-10-14T15:59:59Z"),
      30
    );
    expect(trend.points.find((p) => p.start === "2026-10-05")!.starts).toBe(3);
  });

  it("METRICS defines every key with a label, definition and window; stage rows use screen labels", () => {
    const keys: MetricKey[] = ["seatsFilled", "starts", "daysToFill", "backoutRate", "backoutsAfterClientReview", "withdrawals", "overdueCandidates", "criticalWaits", "lateRequests", "openRequests", "filledNoStart", "activeApplicants"];
    for (const k of keys) {
      expect(METRICS[k].key).toBe(k);
      expect(METRICS[k].label).not.toBe("");
      expect(METRICS[k].definition).not.toBe("");
      expect(["Right now", "In these dates"]).toContain(METRICS[k].window);
    }
    expect(STAGE_ROWS.map((r) => r.label)).toEqual(["Submitted", "Initial screening", "Client review", "Final interview", "Requirements", "Contract signing", "Deployed"]);
  });
});
