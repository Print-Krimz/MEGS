import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

// Fully mocked: no database access.
const m = vi.hoisted(() => ({
  employeeFindMany: vi.fn(),
  userFindMany: vi.fn(),
  deploymentFindMany: vi.fn(),
  deploymentCount: vi.fn(),
  mrfFindMany: vi.fn(),
  applicationFindMany: vi.fn(),
}));

vi.mock("../utils/prisma.js", () => ({
  default: {
    employee: { findMany: m.employeeFindMany },
    user: { findMany: m.userFindMany },
    deployment: { findMany: m.deploymentFindMany, count: m.deploymentCount },
    manpowerRequest: { findMany: m.mrfFindMany },
    application: { findMany: m.applicationFindMany },
  },
}));
vi.mock("../utils/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock("../services/document/document.service.js", () => ({ resolveDocumentSignedUrl: vi.fn() }));
vi.mock("../utils/supabase.js", () => ({ supabase: {}, default: {} }));
vi.mock("../utils/notification.js", () => ({ notifyJobOwner: vi.fn(async () => 0), notifyOwner: vi.fn(async () => 0), sendRoleNotification: vi.fn(), sendNotification: vi.fn() }));

import { employeeSchema, MAX_SUGGESTION_EMPLOYEE_IDS } from "../schemas/employee.schema.js";
import { taSchema } from "../schemas/ta.schema.js";
import { getRedeploymentQueueSummary, listRedeploymentQueue } from "../services/employee/employee.service.js";
import { listMRFs } from "../services/ta/ta.mrf.service.js";
import { listDeployments } from "../services/ta/ta.deployments.service.js";
import { getInterviewComplianceReport } from "../services/ta/ta.interviews.service.js";

const parseQuery = (schema: any, query: Record<string, unknown>) => schema.safeParse({ query });

describe("opt-in pagination validation", () => {
  const paged = [
    ["TA MRFs", taSchema.listMRFs],
    ["TA deployments", taSchema.listDeployments],
    ["interview compliance", taSchema.listInterviewCompliance],
    ["redeployment queue", employeeSchema.redeploymentQueue],
  ] as const;

  it.each(paged)("%s accepts no pagination (legacy) and valid page values", (_name, schema) => {
    expect(parseQuery(schema, {}).success).toBe(true);
    const parsed = parseQuery(schema, { page: "2", pageSize: "100" });
    expect(parsed.success).toBe(true);
    expect((parsed as any).data.query).toMatchObject({ page: 2, pageSize: 100 });
  });

  it.each(paged)("%s rejects non-positive pages and page sizes above 100", (_name, schema) => {
    for (const bad of [{ page: "0" }, { page: "-1" }, { page: "1.5" }, { page: "abc" }, { pageSize: "0" }, { pageSize: "101" }, { pageSize: "1e2" }]) {
      expect(parseQuery(schema, bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("deployment filter accepts the two ended-worker views", () => {
    expect(parseQuery(taSchema.listDeployments, { status: "ENDED_REDEPLOYMENT", page: 1, pageSize: 10 }).success).toBe(true);
    expect(parseQuery(taSchema.listDeployments, { status: "ENDED_SEPARATED" }).success).toBe(true);
    expect(parseQuery(taSchema.listDeployments, { status: "NOPE" }).success).toBe(false);
  });

  it("redeployment suggestions: employeeIds is optional, de-duplicated, and capped at 25 unique IDs", () => {
    expect(parseQuery(employeeSchema.redeploymentSuggestions, {}).success).toBe(true);
    const ok = parseQuery(employeeSchema.redeploymentSuggestions, { employeeIds: "5,3,5, 9" }) as any;
    expect(ok.data.query.employeeIds).toEqual([5, 3, 9]);

    const twentyFive = Array.from({ length: MAX_SUGGESTION_EMPLOYEE_IDS }, (_, i) => i + 1).join(",");
    expect(parseQuery(employeeSchema.redeploymentSuggestions, { employeeIds: twentyFive }).success).toBe(true);
    const twentySix = Array.from({ length: MAX_SUGGESTION_EMPLOYEE_IDS + 1 }, (_, i) => i + 1).join(",");
    expect(parseQuery(employeeSchema.redeploymentSuggestions, { employeeIds: twentySix }).success).toBe(false);
    // Duplicates collapse before the cap is applied.
    expect(parseQuery(employeeSchema.redeploymentSuggestions, { employeeIds: `${twentyFive},1,2,3` }).success).toBe(true);

    for (const bad of ["", "0", "-4", "1,,2", "1,a", "1.5", "99999999999", " "]) {
      expect(parseQuery(employeeSchema.redeploymentSuggestions, { employeeIds: bad }).success, bad).toBe(false);
    }
    expect(parseQuery(employeeSchema.redeploymentSuggestions, { other: "1" }).success).toBe(false);
  });

  it("registers the redeployment summary route before every /:id employee route", () => {
    const routes = readFileSync(new URL("../routes/employee/employee.routes.ts", import.meta.url), "utf8");
    const summary = routes.indexOf('"/redeployment-queue/summary"');
    const firstById = routes.search(/router\.\w+\(\s*"\/:id/);
    expect(summary).toBeGreaterThan(-1);
    expect(firstById).toBeGreaterThan(summary);
  });
});

describe("redeployment queue pagination", () => {
  const day = 86_400_000;
  const ago = (days: number) => new Date(Date.now() - days * day);
  // id, stage-driving data, and waiting time. Pool order (follow-up, updated, id) is by id here.
  const pool = [
    { id: 1, name: "Ana Reyes", client: "Alpha Foods", waited: 3, apps: 1, invite: false },
    { id: 2, name: "Ben Cruz", client: "Beta Steel", waited: 20, apps: 0, invite: true },
    { id: 3, name: "Cora Diaz", client: "Alpha Foods", waited: 10, apps: 0, invite: false },
    { id: 4, name: "Dino Lim", client: "Gamma Co", waited: 40, apps: 0, invite: false },
    { id: 5, name: "Eli Tan", client: "Alpha Foods", waited: 5, apps: 0, invite: false },
  ];

  const leanRow = (p: (typeof pool)[number]) => ({
    id: p.id,
    employeeNumber: `EMP-${p.id}`,
    position: "Operator",
    redeploymentAvailableAt: ago(p.waited),
    deployments: [{ actualEnd: ago(p.waited), client: { name: p.client }, mrf: null, application: null, statusHistory: [] }],
    user: {
      applicantProfile: { firstName: p.name.split(" ")[0], lastName: p.name.split(" ")[1], invitations: p.invite ? [{ id: 9 }] : [] },
      applications: p.apps ? [{ id: 70 + p.id }] : [],
    },
  });
  const fullRow = (p: (typeof pool)[number]) => ({
    id: p.id,
    employeeNumber: `EMP-${p.id}`,
    position: "Operator",
    redeploymentAvailableAt: ago(p.waited),
    redeploymentFollowUpAt: null,
    redeploymentOwnerId: null,
    redeploymentOwner: null,
    redeploymentNotes: null,
    deployments: [{ actualEnd: ago(p.waited), client: { name: p.client }, mrf: null, application: null, statusHistory: [] }],
    user: {
      applicantProfile: { id: 500 + p.id, firstName: p.name.split(" ")[0], lastName: p.name.split(" ")[1], invitations: p.invite ? [{ id: 9, jobPosting: { title: "Packer" } }] : [] },
      applications: p.apps ? [{ id: 70 + p.id, status: "SUBMITTED", jobPosting: { title: "Packer", mrf: { client: { name: "Alpha Foods" } } } }] : [],
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    m.userFindMany.mockResolvedValue([{ id: "u1", email: "ta@megs.ph" }]);
    m.employeeFindMany.mockImplementation(async (args: any) => {
      if (args.select) return pool.map(leanRow);
      const ids: number[] | undefined = args.where?.id?.in;
      return pool.filter((p) => !ids || ids.includes(p.id)).map(fullRow);
    });
    m.deploymentFindMany.mockImplementation(async (args: any) =>
      (args.where.employeeId.in as number[]).map((employeeId) => ({ employeeId, clientId: 7, client: { name: "Alpha Foods" } }))
    );
  });

  it("returns one ordered page (stage first, then longest waiting) with whole-queue stage counts", async () => {
    const page1 = (await listRedeploymentQueue({ id: "ta-1", role: "TALENT_ACQUISITION" }, { page: 1, pageSize: 2 })) as any;
    // Needs placement: Dino (40d), Cora (10d), Eli (5d); then waiting for reply: Ben; then applying: Ana.
    expect(page1.items.map((row: any) => row.id)).toEqual([4, 3]);
    expect(page1).toMatchObject({ total: 5, page: 1, pageSize: 2, totalPages: 3 });
    expect(page1.summary).toEqual({ total: 5, stages: { NEEDS_PLACEMENT: 3, WAITING_FOR_REPLY: 1, IN_PROGRESS: 1 } });
    expect(page1.staff).toEqual([{ id: "u1", email: "ta@megs.ph" }]);

    const last = (await listRedeploymentQueue(undefined, { page: 3, pageSize: 2 })) as any;
    expect(last.items.map((row: any) => row.id)).toEqual([1]);
    expect(last.items[0].stage).toBe("IN_PROGRESS");
    const beyond = (await listRedeploymentQueue(undefined, { page: 9, pageSize: 2 })) as any;
    expect(beyond.items).toEqual([]);
    expect(beyond.total).toBe(5);
  });

  it("applies stage and search filters before paging while the summary stays whole-queue", async () => {
    const waiting = (await listRedeploymentQueue(undefined, { page: 1, pageSize: 10, stage: "WAITING_FOR_REPLY" })) as any;
    expect(waiting.items.map((row: any) => row.id)).toEqual([2]);
    expect(waiting.total).toBe(1);
    expect(waiting.summary.total).toBe(5);

    const searched = (await listRedeploymentQueue(undefined, { page: 1, pageSize: 10, search: " alpha " })) as any;
    expect(searched.items.map((row: any) => row.id)).toEqual([3, 5, 1]);
    expect(searched.total).toBe(3);
  });

  it("loads full rows and placement history only for the requested page, grouped per worker", async () => {
    const result = (await listRedeploymentQueue(undefined, { page: 1, pageSize: 2 })) as any;
    const fullCall = m.employeeFindMany.mock.calls.find(([args]: any) => args.include)![0];
    expect(fullCall.where.id).toEqual({ in: [4, 3] });
    expect(m.deploymentFindMany).toHaveBeenCalledTimes(1);
    expect(m.deploymentFindMany.mock.calls[0][0].where.employeeId).toEqual({ in: [4, 3] });
    expect(result.items.every((row: any) => row.pastClients.length === 1 && row.pastClients[0].id === 7)).toBe(true);
  });

  it("scopes the stage to applications the TA owns", async () => {
    await listRedeploymentQueue({ id: "ta-1", role: "TALENT_ACQUISITION" }, { page: 1, pageSize: 5 });
    const indexCall = m.employeeFindMany.mock.calls.find(([args]: any) => args.select)![0];
    expect(JSON.stringify(indexCall.select.user.select.applications.where)).toContain("ta-1");
  });

  it("summary endpoint returns stage counts without loading full rows or placements", async () => {
    const summary = await getRedeploymentQueueSummary();
    expect(summary).toEqual({ total: 5, stages: { NEEDS_PLACEMENT: 3, WAITING_FOR_REPLY: 1, IN_PROGRESS: 1 } });
    expect(m.employeeFindMany.mock.calls.every(([args]: any) => args.select && !args.include)).toBe(true);
    expect(m.deploymentFindMany).not.toHaveBeenCalled();
  });

  it("keeps the legacy response (no pagination envelope) when no page is requested", async () => {
    const legacy = (await listRedeploymentQueue()) as any;
    expect(Object.keys(legacy).sort()).toEqual(["items", "staff"]);
    expect(legacy.items).toHaveLength(5);
    expect(legacy.items[0].pastClients).toEqual([{ id: 7, name: "Alpha Foods" }]);
  });
});

describe("TA MRF pagination", () => {
  const rows = [
    { id: 1, title: "A", status: "FILLED", priority: "URGENT", headcount: 1, targetFillDate: null, createdAt: new Date("2026-01-01") },
    { id: 2, title: "B", status: "OPEN", priority: "LOW", headcount: 1, targetFillDate: null, createdAt: new Date("2026-02-01") },
    { id: 3, title: "C", status: "OPEN", priority: "URGENT", headcount: 1, targetFillDate: new Date("2026-09-01"), createdAt: new Date("2026-03-01") },
    { id: 4, title: "D", status: "OPEN", priority: "URGENT", headcount: 1, targetFillDate: new Date("2026-08-01"), createdAt: new Date("2026-04-01") },
  ];
  beforeEach(() => {
    vi.clearAllMocks();
    m.mrfFindMany.mockImplementation(async (args: any) => {
      const ids: number[] | undefined = args.where?.id?.in;
      const matched = rows.filter((row) => !ids || ids.includes(row.id));
      return args.select ? matched.map(({ id, status, priority, targetFillDate, createdAt }) => ({ id, status, priority, targetFillDate, createdAt })) : matched.map((row) => ({ ...row, client: { id: 1, name: "X" }, createdBy: null, deployments: [], _count: { jobPostings: 0, deployments: 0 } }));
    });
  });

  it("orders before slicing (priority sort) and loads full rows for the page only", async () => {
    const page1 = (await listMRFs(undefined, undefined, undefined, "priority", undefined, { page: 1, pageSize: 2 })) as any;
    // Active first, urgent first, soonest target first: D, C | then B, then filled A.
    expect(page1.items.map((item: any) => item.id)).toEqual([4, 3]);
    expect(page1).toMatchObject({ total: 4, page: 1, pageSize: 2, totalPages: 2 });
    const page2 = (await listMRFs(undefined, undefined, undefined, "priority", undefined, { page: 2, pageSize: 2 })) as any;
    expect(page2.items.map((item: any) => item.id)).toEqual([2, 1]);
    expect(page2.items[0].fulfillment).toMatchObject({ headcount: 1, deployedCount: 0 });
    const detailCall = m.mrfFindMany.mock.calls.filter(([args]: any) => args.include).at(-1)![0];
    expect(detailCall.where.id).toEqual({ in: [2, 1] });
  });

  it("filters by search (title or client) and ownership before counting", async () => {
    await listMRFs(3, "OPEN", "HIGH", "created_desc", { id: "ta-1", role: "TALENT_ACQUISITION" }, { page: 1, pageSize: 8, search: " steel " });
    const keyCall = m.mrfFindMany.mock.calls[0][0];
    expect(keyCall.where).toMatchObject({ assignedTaId: "ta-1", clientId: 3, status: "OPEN", priority: "HIGH" });
    expect(JSON.stringify(keyCall.where.AND)).toContain("steel");
    expect(JSON.stringify(keyCall.where.AND)).toContain('"client"');
  });

  it("keeps the legacy array response when no page is requested", async () => {
    const legacy = (await listMRFs(undefined, undefined, undefined, "created_desc")) as any;
    expect(Array.isArray(legacy)).toBe(true);
    expect(legacy.map((item: any) => item.id)).toEqual([4, 3, 2, 1]);
  });
});

describe("TA deployment pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.deploymentFindMany.mockResolvedValue([{ id: 11 }, { id: 10 }]);
    m.deploymentCount.mockResolvedValue(23);
  });

  it("pages in the database with a stable id tie-breaker and a matching count", async () => {
    const result = (await listDeployments(5, "ACTIVE", { id: "ta-1", role: "TALENT_ACQUISITION" }, { page: 3, pageSize: 10, search: "Plant" })) as any;
    const call = m.deploymentFindMany.mock.calls[0][0];
    expect(call).toMatchObject({ skip: 20, take: 10, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    expect(call.where).toMatchObject({ clientId: 5, status: "ACTIVE" });
    expect(JSON.stringify(call.where.OR)).toContain("ta-1");
    expect(JSON.stringify(call.where.AND)).toContain("Plant");
    expect(m.deploymentCount.mock.calls[0][0].where).toEqual(call.where);
    expect(result).toEqual({ items: [{ id: 11 }, { id: 10 }], total: 23, page: 3, pageSize: 10, totalPages: 3 });
  });

  it("filters ended workers by employee status in the database", async () => {
    await listDeployments(undefined, "ENDED_REDEPLOYMENT", undefined, { page: 1, pageSize: 10 });
    expect(m.deploymentFindMany.mock.calls[0][0].where).toMatchObject({ status: "ENDED", employee: { is: { status: "AVAILABLE_FOR_REDEPLOYMENT" } } });
    await listDeployments(undefined, "ENDED_SEPARATED", undefined, { page: 1, pageSize: 10 });
    expect(m.deploymentFindMany.mock.calls[1][0].where).toMatchObject({ status: "ENDED", employee: { is: { status: "SEPARATED" } } });
  });

  it("keeps the legacy array response and never counts when no page is requested", async () => {
    const legacy = await listDeployments(undefined, undefined, undefined);
    expect(legacy).toEqual([{ id: 11 }, { id: 10 }]);
    expect(m.deploymentCount).not.toHaveBeenCalled();
    expect(m.deploymentFindMany.mock.calls[0][0].skip).toBeUndefined();
  });
});

describe("interview compliance pagination", () => {
  const now = Date.now();
  const app = (id: number, name: string, title: string, status: string, ageDays: number) => ({
    id,
    status,
    updatedAt: new Date(now - ageDays * 86_400_000 - 60_000),
    jobPosting: { title },
    user: { applicantProfile: { firstName: name, lastName: "Tester" } },
    interviews: [],
  });
  beforeEach(() => {
    vi.clearAllMocks();
    m.applicationFindMany.mockResolvedValue([
      app(1, "Ana", "Welder", "INITIAL_SCREENING", 9),
      app(2, "Ben", "Welder", "FINAL_INTERVIEW", 5),
      app(3, "Cy", "Driver", "INITIAL_SCREENING", 1),
      app(4, "Di", "Driver", "INITIAL_SCREENING", 8),
    ]);
  });

  it("returns the legacy report when no page is requested", async () => {
    const report = (await getInterviewComplianceReport()) as any;
    expect(report.details).toHaveLength(4);
    expect(report.items).toBeUndefined();
  });

  it("filters, sorts, and pages the report while summary and positions stay unfiltered", async () => {
    const page = (await getInterviewComplianceReport(undefined, { page: 1, pageSize: 2, status: "BREACHED", sortField: "candidate", sortDirection: "desc" })) as any;
    expect(page.items.map((item: any) => item.applicationId)).toEqual([4, 1]);
    expect(page).toMatchObject({ total: 2, page: 1, pageSize: 2, totalPages: 1 });
    expect(page.summary).toEqual({ total: 4, breached: 2, warning: 1, healthy: 1 });
    expect(page.positions).toEqual(["Driver", "Welder"]);

    const searched = (await getInterviewComplianceReport(undefined, { page: 2, pageSize: 1, search: "driver", stage: "INITIAL_SCREENING" })) as any;
    expect(searched.total).toBe(2);
    expect(searched.items).toHaveLength(1);
    expect(searched.totalPages).toBe(2);
  });
});
