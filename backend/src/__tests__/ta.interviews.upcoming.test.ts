import { beforeEach, describe, expect, it, vi } from "vitest";

// Fully mocked: no database access.
const m = vi.hoisted(() => ({ applicationFindMany: vi.fn() }));

vi.mock("../utils/prisma.js", () => ({ default: { application: { findMany: m.applicationFindMany } } }));
vi.mock("../utils/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock("../utils/notification.js", () => ({ notifyJobOwner: vi.fn(async () => 0), notifyOwner: vi.fn(async () => 0), sendRoleNotification: vi.fn(), sendNotification: vi.fn() }));
vi.mock("../services/scheduling/reschedule.service.js", () => ({ resolvePendingRescheduleRequest: vi.fn() }));
vi.mock("../services/ta/backout.service.js", () => ({ recordBackout: vi.fn() }));

import { taSchema } from "../schemas/ta.schema.js";
import { getInterviewComplianceReport } from "../services/ta/ta.interviews.service.js";

const app = (id: number, status: string, interviews: Array<{ id: number; type: string; scheduledAt: Date }>) => ({
  id,
  status,
  updatedAt: new Date("2026-10-28T00:00:00Z"),
  jobPosting: { title: "Welder" },
  user: { applicantProfile: { firstName: `A${id}`, lastName: "T" } },
  interviews,
});

describe("interview compliance scheduled window", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.applicationFindMany.mockResolvedValue([]);
  });

  it("leaves the query untouched without the new filters", async () => {
    await getInterviewComplianceReport();
    const call = m.applicationFindMany.mock.calls[0][0];
    expect(call.where.interviews).toBeUndefined();
    expect(call.select.interviews.where).toEqual({ isActive: true, OR: [{ result: null }, { result: { in: ["PENDING", "SCHEDULED"] } }] });
  });

  it("filters scheduled interviews in the database using Manila midnight bounds, end date inclusive", async () => {
    await getInterviewComplianceReport(undefined, { scheduledOnly: "true", from: "2026-10-29", to: "2026-11-04" });
    const where = m.applicationFindMany.mock.calls[0][0].where;
    const window = where.interviews.some;
    expect(window.isActive).toBe(true);
    // 2026-10-29 00:00 Manila is 2026-10-28 16:00 UTC; the day after the end date starts 2026-11-04 16:00 UTC.
    expect(window.scheduledAt.gte.toISOString()).toBe("2026-10-28T16:00:00.000Z");
    expect(window.scheduledAt.lt.toISOString()).toBe("2026-11-04T16:00:00.000Z");
    expect(m.applicationFindMany.mock.calls[0][0].select.interviews.where.scheduledAt).toEqual(window.scheduledAt);
  });

  it("scheduledOnly alone requires a scheduled time", async () => {
    await getInterviewComplianceReport(undefined, { scheduledOnly: true });
    expect(m.applicationFindMany.mock.calls[0][0].where.interviews.some.scheduledAt).toEqual({ not: null });
  });

  it("keeps ownership scoping alongside the window", async () => {
    await getInterviewComplianceReport({ id: "ta-1", role: "TALENT_ACQUISITION" } as any, { scheduledOnly: "true" });
    expect(JSON.stringify(m.applicationFindMany.mock.calls[0][0].where)).toContain("ta-1");
  });

  it("returns an upcoming interview even when more than a page of other rows exist, with authoritative totals", async () => {
    const at = new Date("2026-10-30T02:00:00Z");
    // The database already dropped older and unscheduled rows; 60 matches span three pages of 25.
    m.applicationFindMany.mockResolvedValue(
      Array.from({ length: 60 }, (_, index) => app(index + 1, "INITIAL_SCREENING", [{ id: 100 + index, type: "INITIAL_SCREENING", scheduledAt: new Date(at.getTime() + index * 60_000) }])),
    );
    const page = (await getInterviewComplianceReport(undefined, { scheduledOnly: "true", from: "2026-10-29", to: "2026-11-04", page: 3, pageSize: 25, sortField: "scheduledAt", sortDirection: "asc" })) as any;
    expect(page.total).toBe(60);
    expect(page.totalPages).toBe(3);
    expect(page.items).toHaveLength(10);
    expect(page.items[0].scheduledAt).toBe(new Date(at.getTime() + 50 * 60_000).toISOString());
  });

  it("drops rows whose only open interview belongs to another stage", async () => {
    m.applicationFindMany.mockResolvedValue([
      app(1, "FINAL_INTERVIEW", [{ id: 1, type: "INITIAL_SCREENING", scheduledAt: new Date("2026-10-30T02:00:00Z") }]),
      app(2, "FINAL_INTERVIEW", [{ id: 2, type: "FINAL_INTERVIEW", scheduledAt: new Date("2026-10-30T03:00:00Z") }]),
    ]);
    const report = (await getInterviewComplianceReport(undefined, { scheduledOnly: true })) as any;
    expect(report.details.map((row: any) => row.applicationId)).toEqual([2]);
  });

  it("validates the new query fields", () => {
    const parse = (query: Record<string, unknown>) => taSchema.listInterviewCompliance.safeParse({ query });
    expect(parse({ scheduledOnly: "true", from: "2026-10-29", to: "2026-11-04" }).success).toBe(true);
    expect(parse({ from: "2026-13-01" }).success).toBe(false);
    expect(parse({ from: "2026-11-05", to: "2026-11-04" }).success).toBe(false);
    expect(parse({ scheduledOnly: "yes" }).success).toBe(false);
  });
});
