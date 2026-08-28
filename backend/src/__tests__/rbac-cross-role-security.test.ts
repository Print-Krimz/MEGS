import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock Supabase & Prisma
const mockGetUser = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("../utils/supabase.js", () => ({
  default: { auth: { getUser: (...args: any[]) => mockGetUser(...args) } },
}));

vi.mock("../utils/prisma.js", () => ({
  default: {
    user: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
      findMany: vi.fn().mockResolvedValue([]),
    },
    manpowerRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import taRoutes from "../routes/ta/ta.routes.js";
import adminRoutes from "../routes/admin/admin.routes.js";
import applicantRoutes from "../routes/applicant/applicant.routes.js";
import applicationRoutes from "../routes/applicant/application.routes.js";
import { createMRF } from "../services/ta/ta.mrf.service.js";
import * as notificationUtil from "../utils/notification.js";
import prisma from "../utils/prisma.js";

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/ta", taRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/applicants", applicantRoutes);
  app.use("/api/applicant-jobs", applicationRoutes);
  return app;
};

describe("RBAC Cross-Role Security & Notification Link Suite", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  const setupAuthUser = (role: "ADMINISTRATOR" | "TALENT_ACQUISITION" | "APPLICANT", id = "test-user-id") => {
    mockGetUser.mockResolvedValue({
      data: { user: { id } },
      error: null,
    });
    mockFindUnique.mockResolvedValue({
      id,
      email: `${role.toLowerCase()}@megs.test`,
      role,
      isActive: true,
      accountStatus: "ACTIVE",
      mustChangePassword: false,
    });
  };

  describe("1. Admin -> TA Route Restriction (Admin must NOT access TA routes)", () => {
    it("rejects an Administrator trying to access GET /api/ta/applications with 403 Forbidden", async () => {
      setupAuthUser("ADMINISTRATOR");

      const res = await request(app)
        .get("/api/ta/applications")
        .set("Authorization", "Bearer valid-admin-token");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/permission/i);
    });

    it("rejects an Administrator trying to access GET /api/ta/mrfs with 403 Forbidden", async () => {
      setupAuthUser("ADMINISTRATOR");

      const res = await request(app)
        .get("/api/ta/mrfs")
        .set("Authorization", "Bearer valid-admin-token");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("rejects an Administrator trying to access GET /api/ta/jobs with 403 Forbidden", async () => {
      setupAuthUser("ADMINISTRATOR");

      const res = await request(app)
        .get("/api/ta/jobs")
        .set("Authorization", "Bearer valid-admin-token");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe("2. TA -> Admin Route Restriction (TA must NOT access Admin routes)", () => {
    it("rejects a TA user trying to access GET /api/admin/users with 403 Forbidden", async () => {
      setupAuthUser("TALENT_ACQUISITION");

      const res = await request(app)
        .get("/api/admin/users")
        .set("Authorization", "Bearer valid-ta-token");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/permission/i);
    });

    it("rejects a TA user trying to access GET /api/admin/candidate-scoring/configuration with 403 Forbidden", async () => {
      setupAuthUser("TALENT_ACQUISITION");

      const res = await request(app)
        .get("/api/admin/candidate-scoring/configuration")
        .set("Authorization", "Bearer valid-ta-token");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("rejects a TA user trying to access GET /api/admin/audit-logs with 403 Forbidden", async () => {
      setupAuthUser("TALENT_ACQUISITION");

      const res = await request(app)
        .get("/api/admin/audit-logs")
        .set("Authorization", "Bearer valid-ta-token");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe("3. Applicant -> Internal Staff Routes (Applicant must NOT access TA or Admin routes)", () => {
    it("rejects an Applicant trying to access GET /api/ta/applications with 403 Forbidden", async () => {
      setupAuthUser("APPLICANT");

      const res = await request(app)
        .get("/api/ta/applications")
        .set("Authorization", "Bearer valid-applicant-token");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("rejects an Applicant trying to access GET /api/admin/users with 403 Forbidden", async () => {
      setupAuthUser("APPLICANT");

      const res = await request(app)
        .get("/api/admin/users")
        .set("Authorization", "Bearer valid-applicant-token");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe("4. Admin MRF Detail Endpoint (GET /api/admin/mrfs/:id)", () => {
    it("allows an Administrator to view MRF details via /api/admin/mrfs/:id", async () => {
      setupAuthUser("ADMINISTRATOR");

      const mockMRF = {
        id: 42,
        title: "Senior Full Stack Developer",
        headcount: 2,
        location: "Makati City",
        status: "OPEN",
        priority: "HIGH",
        client: { id: 1, name: "Acme Corporation" },
        jobPostings: [],
        complianceTemplates: [],
        deployments: [],
      };

      vi.spyOn(prisma.manpowerRequest, "findUnique").mockResolvedValue(mockMRF as any);

      const res = await request(app)
        .get("/api/admin/mrfs/42")
        .set("Authorization", "Bearer valid-admin-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(42);
      expect(res.body.data.title).toBe("Senior Full Stack Developer");
    });
  });

  describe("5. Notification Route Generation Role Alignment", () => {
    it("generates an /admin/mrfs/:id link for ADMINISTRATOR recipients when MRF is created", async () => {
      const sendRoleSpy = vi.spyOn(notificationUtil, "sendRoleNotification").mockResolvedValue();
      vi.spyOn(prisma.client, "findUnique").mockResolvedValue({ id: 1, name: "Acme Corporation" } as any);
      vi.spyOn(prisma.manpowerRequest, "create").mockResolvedValue({
        id: 77,
        title: "Senior Logistics Dispatcher",
        headcount: 1,
        clientId: 1,
        client: { id: 1, name: "Acme Corporation" },
        complianceTemplates: [],
      } as any);

      await createMRF("ta-user-1", {
        clientId: 1,
        title: "Senior Logistics Dispatcher",
        headcount: 1,
      });

      expect(sendRoleSpy).toHaveBeenCalledWith(
        "ADMINISTRATOR",
        "New Manpower Request (MRF)",
        expect.stringContaining("Senior Logistics Dispatcher"),
        "INFO",
        "/admin/mrfs/77",
        "ta-user-1"
      );
    });
  });
});
