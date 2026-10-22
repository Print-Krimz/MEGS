import { describe, expect, it, vi } from "vitest";

// Importing the routers pulls in every controller, so the database and auth are mocked. No request is made.
vi.mock("../utils/supabase.js", () => ({ default: { auth: { getClaims: vi.fn() }, storage: { from: vi.fn() } } }));
vi.mock("../utils/prisma.js", () => ({ default: {} }));

import taRoutes from "../routes/ta/ta.routes.js";
import employeeRoutes from "../routes/employee/employee.routes.js";

interface RouteInfo {
  method: string;
  path: string;
  guards: string[];
}

const collect = (router: any): RouteInfo[] =>
  router.stack
    .filter((layer: any) => layer.route)
    .flatMap((layer: any) =>
      Object.keys(layer.route.methods).map((method) => ({
        method: method.toUpperCase(),
        path: layer.route.path as string,
        guards: layer.route.stack.map((l: any) => l.handle?.ownershipKind).filter(Boolean) as string[],
      }))
    );

// Routes that take an id but are deliberately not guarded by record ownership.
const EXEMPT: Record<string, string> = {
  "DELETE /talent-pool/invitations/:id": "the service only lets the TA who sent the invitation cancel it",
  "GET /walk-ins/check-ins/:id": "pending self check-ins are shared on purpose so any TA at the desk can confirm them",
  "GET /walk-ins/check-ins/:id/biodata": "pending self check-ins are shared on purpose so any TA at the desk can confirm them",
  "POST /walk-ins/check-ins/:id/confirm": "pending self check-ins are shared on purpose so any TA at the desk can confirm them",
  "POST /walk-ins/check-ins/:id/dismiss": "pending self check-ins are shared on purpose so any TA at the desk can confirm them",
};

describe("every by-id TA route is guarded by record ownership", () => {
  const routes = collect(taRoutes).filter((r) => r.path.includes(":"));

  it("finds the by-id routes", () => {
    expect(routes.length).toBeGreaterThan(40);
  });

  it("guards each one, so a TA cannot read or change another TA's record by guessing its id", () => {
    const unguarded = routes
      .filter((r) => r.guards.length === 0)
      .map((r) => `${r.method} ${r.path}`)
      .filter((key) => !(key in EXEMPT));
    expect(unguarded).toEqual([]);
  });

  it("keeps the exemptions honest: they exist, and nothing else is exempt by accident", () => {
    const keys = routes.map((r) => `${r.method} ${r.path}`);
    for (const key of Object.keys(EXEMPT)) expect(keys).toContain(key);
  });

  it("guards by the right kind of record", () => {
    const kindOf = (method: string, path: string) => routes.find((r) => r.method === method && r.path === path)?.guards;
    expect(kindOf("GET", "/mrfs/:id")).toEqual(["mrf"]);
    expect(kindOf("GET", "/clients/:id")).toEqual(["client"]);
    expect(kindOf("PATCH", "/jobs/:id")).toEqual(["job"]);
    expect(kindOf("GET", "/applications/:id")).toEqual(["application"]);
    expect(kindOf("PATCH", "/deployments/:id/status")).toEqual(["deployment"]);
    expect(kindOf("PATCH", "/compliance/:requirementId/review")).toEqual(["requirement"]);
    expect(kindOf("DELETE", "/mrfs/compliance-templates/:templateId")).toEqual(["template"]);
    expect(kindOf("PATCH", "/candidates/:id")).toEqual(["candidate"]);
    expect(kindOf("POST", "/talent-pool/invitations/:id/assisted-response")).toEqual(["invitation"]);
    expect(kindOf("POST", "/talent-pool/invitations/:id/sms-link")).toEqual(["invitation"]);
    expect(kindOf("POST", "/walk-ins/:id/slip")).toEqual(["application"]);
    // The id is an application id; its candidate's profile seeds the search.
    expect(kindOf("GET", "/candidates/:candidateId/similar")).toEqual(["application"]);
    // A nested record is checked on its own as well as through its application
    expect(kindOf("PATCH", "/applications/:id/interviews/:interviewId/status")).toEqual(["application", "interview"]);
    expect(kindOf("PATCH", "/applications/:id/endorsements/:endorsementId")).toEqual(["application", "endorsement"]);
  });
});

describe("every by-id employee route is guarded by record ownership", () => {
  const routes = collect(employeeRoutes).filter((r) => r.path.includes(":"));

  it("guards each one", () => {
    const unguarded = routes.filter((r) => r.guards.length === 0).map((r) => `${r.method} ${r.path}`);
    expect(unguarded).toEqual([]);
  });

  it("limits the private employee file to owners and shares only the pool view", () => {
    const kindOf = (method: string, path: string) => routes.find((r) => r.method === method && r.path === path)?.guards;
    expect(kindOf("GET", "/:id/digital-201")).toEqual(["employee"]);
    expect(kindOf("PATCH", "/:id/details")).toEqual(["employee"]);
    expect(kindOf("PATCH", "/:id/status")).toEqual(["employee"]);
    expect(kindOf("GET", "/:id")).toEqual(["employeePool"]);
    expect(kindOf("POST", "/:id/deployments")).toEqual(["employeePool"]);
    expect(kindOf("POST", "/deployments/:id/end")).toEqual(["deployment"]);
  });
});
