import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DISABLE_RATE_LIMIT = "true";

const { prisma, sendNotification, logAudit } = vi.hoisted(() => ({
  prisma: {
    application: { findMany: vi.fn() },
    user: { findMany: vi.fn(), findUnique: vi.fn() },
  },
  sendNotification: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("../../utils/prisma.js", () => ({ default: prisma }));
vi.mock("../../utils/notification.js", () => ({ sendNotification }));
vi.mock("../../utils/audit.js", () => ({ logAudit }));
vi.mock("../../utils/supabase.js", () => ({ default: { auth: {} } }));
vi.mock("../../middleware/auth.middleware.js", () => ({
  authenticateJWT: (req: any, _res: any, next: any) => {
    req.user = { id: "admin1", role: req.header("x-role") ?? "ADMINISTRATOR" };
    next();
  },
  requireRole: (role: string) => (req: any, res: any, next: any) =>
    req.user.role === role ? next() : res.status(403).json({ success: false }),
}));

import router from "./admin.routes.js";

const app = express();
app.use(express.json());
app.use("/api/admin", router);

const post = (body: unknown, role?: string) => {
  const r = request(app).post("/api/admin/analytics/remind");
  return (role ? r.set("x-role", role) : r).send(body as object);
};
const job = (assignedTaId: string | null) => ({ postedById: "poster", mrfId: assignedTaId ? 1 : 2, mrf: { assignedTaId } });

describe("POST /api/admin/analytics/remind", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendNotification.mockResolvedValue("sent");
    prisma.user.findUnique.mockResolvedValue({ role: "ADMINISTRATOR", displayName: "Nia Admin", email: "a@x.test" });
  });

  it("rejects a bad body with 400", async () => {
    for (const body of [{}, { applicationIds: [] }, { applicationIds: ["x"] }, { applicationIds: [0] }, { applicationIds: [1], extra: 1 }, { applicationIds: Array.from({ length: 101 }, (_, i) => i + 1) }]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("is admin only", async () => {
    expect((await post({ applicationIds: [1] }, "TALENT_ACQUISITION")).status).toBe(403);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("sends one notification per recruiter, skips unowned or unknown ids, and writes an audit entry", async () => {
    prisma.application.findMany.mockResolvedValue([
      { id: 1, jobPosting: job("ta1") },
      { id: 2, jobPosting: job("ta1") },
      { id: 3, jobPosting: job("ta2") },
      { id: 4, jobPosting: job(null) },
      { id: 5, jobPosting: job("boss") }, // owned by a non-recruiter
    ]);
    prisma.user.findMany.mockResolvedValue([{ id: "ta1" }, { id: "ta2" }]);

    const res = await post({ applicationIds: [1, 2, 3, 4, 5, 6, 3] });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ reminded: 2, candidates: 3, skipped: 3 });
    expect(prisma.application.findMany.mock.calls[0][0].where.id.in).toEqual([1, 2, 3, 4, 5, 6]);

    expect(sendNotification).toHaveBeenCalledTimes(2);
    const [id, title, message, type, link, options] = sendNotification.mock.calls.find((c) => c[0] === "ta1")!;
    expect([id, title, type, link]).toEqual(["ta1", "Overdue candidates", "WARNING", "/ta/analytics?tab=waiting"]);
    expect(message).toBe("Nia Admin (Admin) asked you to follow up on 2 overdue candidates.");
    expect(options.dedupeKey).toMatch(/^admin-remind:ta1:\d{4}-\d{2}-\d{2}:[0-9a-f]{12}$/);
    expect(options.sendEmail).toBeUndefined();
    expect(sendNotification.mock.calls.find((c) => c[0] === "ta2")![2]).toBe("Nia Admin (Admin) asked you to follow up on 1 overdue candidate.");
    expect(logAudit).toHaveBeenCalledWith("admin1", "ANALYTICS_RECRUITERS_REMINDED", "Application", null, expect.objectContaining({ recruiters: 2, candidates: 3, skipped: 3, actor: { id: "admin1", name: "Nia Admin", role: "ADMINISTRATOR", email: "a@x.test" } }));
  });

  it("never puts the admin's email in the message when the account has no name", async () => {
    prisma.user.findUnique.mockResolvedValue({ role: "ADMINISTRATOR", displayName: null, email: "admin@megs-recruitment.com" });
    prisma.application.findMany.mockResolvedValue([{ id: 1, jobPosting: job("ta1") }]);
    prisma.user.findMany.mockResolvedValue([{ id: "ta1" }]);
    await post({ applicationIds: [1] });
    const message = sendNotification.mock.calls[0][2] as string;
    expect(message).toBe("An administrator asked you to follow up on 1 overdue candidate.");
    expect(message).not.toContain("@");
    expect(logAudit.mock.calls[0][4].actor.email).toBe("admin@megs-recruitment.com");
  });

  it("counts a repeat of the same reminder as reminded", async () => {
    prisma.application.findMany.mockResolvedValue([{ id: 1, jobPosting: job("ta1") }]);
    prisma.user.findMany.mockResolvedValue([{ id: "ta1" }]);
    sendNotification.mockResolvedValue("duplicate");
    const res = await post({ applicationIds: [1] });
    expect(res.body.data).toEqual({ reminded: 1, candidates: 1, skipped: 0 });
  });
});
