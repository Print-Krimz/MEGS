import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import prisma from "../utils/prisma.js";

let currentMockUser: { id: string; role: string; email: string };

vi.mock("../middleware/auth.middleware.js", () => ({
  authenticateJWT: (req: any, _res: any, next: any) => {
    req.user = currentMockUser;
    next();
  },
  requireRole: (...roles: string[]) => (req: any, res: any, next: any) => {
    if (!currentMockUser || !roles.includes(currentMockUser.role)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  },
}));

import taRoutes from "../routes/ta/ta.routes.js";
import { scheduleNewInterview } from "../services/ta/ta.interviews.service.js";

const app = express();
app.use(express.json());
app.use("/api/ta", taRoutes);

describe("TA Candidate Profile Verification Endpoint (PATCH /api/ta/candidates/:id)", { timeout: 30000 }, () => {
  let taUser: any;
  let applicantUser: any;
  let profileId: number;
  let applicantUserId: string;

  beforeAll(async () => {
    const ts = Date.now();
    taUser = await prisma.user.create({
      data: {
        id: `ta-verify-${ts}`,
        email: `ta-verify-${ts}@megs.ph`,
        role: "TALENT_ACQUISITION",
      },
    });

    applicantUser = await prisma.user.create({
      data: {
        id: `cand-verify-${ts}`,
        email: `cand-verify-${ts}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Jose",
            middleName: "Protacio",
            lastName: "Rizal",
            mobileNumber: "09171234567",
            gender: "Male",
            province: "Laguna",
            city: "Calamba",
            dateOfBirth: new Date("1992-06-19"),
            tattooStatus: "NONE",
          },
        },
      },
      include: {
        applicantProfile: true,
      },
    });

    applicantUserId = applicantUser.id;
    profileId = applicantUser.applicantProfile.id;
    currentMockUser = taUser;
  });

  afterAll(async () => {
    if (profileId) {
      await prisma.candidateFeatureProfile.deleteMany({
        where: { applicantProfileId: profileId },
      });
      await prisma.auditLog.deleteMany({
        where: {
          entity: "ApplicantProfile",
          entityId: profileId,
        },
      });
    }
    if (applicantUserId) {
      await prisma.applicantProfile.deleteMany({
        where: { userId: applicantUserId },
      });
      await prisma.user.deleteMany({
        where: { id: applicantUserId },
      });
    }
    if (taUser) {
      await prisma.user.deleteMany({
        where: { id: taUser.id },
      });
    }
  });

  it("updates candidate profile fields including tattooStatus using profile.id", async () => {
    currentMockUser = taUser;
    const response = await request(app)
      .patch(`/api/ta/candidates/${profileId}`)
      .send({
        firstName: "Dr. Jose",
        lastName: "Mercado",
        middleName: "Alonso",
        mobileNumber: "09181234567",
        dateOfBirth: "1991-05-15",
        gender: "Male",
        city: "Makati City",
        province: "Metro Manila",
        tattooStatus: "VISIBLE",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toContain("verified and updated successfully");
    expect(response.body.data.firstName).toBe("Dr. Jose");
    expect(response.body.data.lastName).toBe("Mercado");
    expect(response.body.data.middleName).toBe("Alonso");
    expect(response.body.data.mobileNumber).toBe("09181234567");
    expect(response.body.data.city).toBe("Makati City");
    expect(response.body.data.province).toBe("Metro Manila");
    expect(response.body.data.tattooStatus).toBe("VISIBLE");

    // Verify persisted directly in database
    const dbProfile = await prisma.applicantProfile.findUnique({
      where: { id: profileId },
    });
    expect(dbProfile).not.toBeNull();
    expect(dbProfile!.firstName).toBe("Dr. Jose");
    expect(dbProfile!.lastName).toBe("Mercado");
    expect(dbProfile!.city).toBe("Makati City");
    expect(dbProfile!.province).toBe("Metro Manila");
    expect(dbProfile!.tattooStatus).toBe("VISIBLE");
  });

  it("updates candidate profile using applicant userId (UUID lookup)", async () => {
    currentMockUser = taUser;
    const response = await request(app)
      .patch(`/api/ta/candidates/${applicantUserId}`)
      .send({
        tattooStatus: "NON_VISIBLE",
        city: "Taguig City",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tattooStatus).toBe("NON_VISIBLE");
    expect(response.body.data.city).toBe("Taguig City");

    // Verify in DB
    const dbProfile = await prisma.applicantProfile.findUnique({
      where: { id: profileId },
    });
    expect(dbProfile!.tattooStatus).toBe("NON_VISIBLE");
    expect(dbProfile!.city).toBe("Taguig City");
  });

  it("allows setting tattooStatus back to NONE", async () => {
    currentMockUser = taUser;
    const response = await request(app)
      .patch(`/api/ta/candidates/${profileId}`)
      .send({
        tattooStatus: "NONE",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tattooStatus).toBe("NONE");

    const dbProfile = await prisma.applicantProfile.findUnique({
      where: { id: profileId },
    });
    expect(dbProfile!.tattooStatus).toBe("NONE");
  });

  it("returns 404 when candidate ID does not exist", async () => {
    currentMockUser = taUser;
    const response = await request(app)
      .patch("/api/ta/candidates/99999999")
      .send({ firstName: "Ghost" });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("Applicant profile not found");
  });

  it("returns 400 when invalid tattooStatus is supplied", async () => {
    currentMockUser = taUser;
    const response = await request(app)
      .patch(`/api/ta/candidates/${profileId}`)
      .send({ tattooStatus: "COVERED_SOMEWHERE" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("Tattoo status must be NONE, NON_VISIBLE, VISIBLE, or null");
  });

  it("returns 400 when invalid phone number is supplied", async () => {
    currentMockUser = taUser;
    const response = await request(app)
      .patch(`/api/ta/candidates/${profileId}`)
      .send({ mobileNumber: "123" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("Contact phone must not exceed 11 digits");
  });

  it("returns 400 when firstName is empty string", async () => {
    currentMockUser = taUser;
    const response = await request(app)
      .patch(`/api/ta/candidates/${profileId}`)
      .send({ firstName: "   " });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("First name cannot be empty");
  });

  it("returns 400 when dateOfBirth is an invalid date string", async () => {
    currentMockUser = taUser;
    const response = await request(app)
      .patch(`/api/ta/candidates/${profileId}`)
      .send({ dateOfBirth: "invalid-calendar-date" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("Invalid dateOfBirth format");
  });

  it("records an audit log when candidate profile is verified", async () => {
    currentMockUser = taUser;
    await request(app)
      .patch(`/api/ta/candidates/${profileId}`)
      .send({
        city: "Pasig City",
        tattooStatus: "NONE",
      });

    // Check audit log in DB
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: "TA_CANDIDATE_PROFILE_VERIFIED",
        entity: "ApplicantProfile",
        entityId: profileId,
      },
      orderBy: { createdAt: "desc" },
    });

    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs[0].userId).toBe(taUser.id);
  });

  it("enforces RBAC by rejecting non-TA roles with 403 Forbidden", async () => {
    currentMockUser = { id: "hacker-1", role: "APPLICANT", email: "hacker@evil.com" };
    const response = await request(app)
      .patch(`/api/ta/candidates/${profileId}`)
      .send({ firstName: "Hacked" });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("updates statutory IDs, address, and emergency contact details via PATCH /api/ta/candidates/:id", async () => {
    currentMockUser = taUser;
    const response = await request(app)
      .patch(`/api/ta/candidates/${profileId}`)
      .send({
        sss: "04-1234567-8",
        philhealth: "11-223344556-7",
        pagibig: "1122-3344-5566",
        tin: "987-654-321-000",
        address: "777 Real St, Calamba City, Laguna",
        emergencyContactName: "Teodora Alonso",
        emergencyContactPhone: "09170001122",
        emergencyContactRelationship: "Mother",
        emergencyContactAddress: "Calamba, Laguna",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.sss).toBe("04-1234567-8");
    expect(response.body.data.philhealth).toBe("11-223344556-7");
    expect(response.body.data.pagibig).toBe("1122-3344-5566");
    expect(response.body.data.tin).toBe("987-654-321-000");
    expect(response.body.data.address).toBe("777 Real St, Calamba City, Laguna");
    expect(response.body.data.emergencyContactName).toBe("Teodora Alonso");
    expect(response.body.data.emergencyContactPhone).toBe("09170001122");
    expect(response.body.data.emergencyContactRelationship).toBe("Mother");
    expect(response.body.data.emergencyContactAddress).toBe("Calamba, Laguna");

    // Verify in database
    const dbProfile = await prisma.applicantProfile.findUnique({
      where: { id: profileId },
    });
    expect(dbProfile!.sss).toBe("04-1234567-8");
    expect(dbProfile!.philhealth).toBe("11-223344556-7");
    expect(dbProfile!.pagibig).toBe("1122-3344-5566");
    expect(dbProfile!.tin).toBe("987-654-321-000");
    expect(dbProfile!.address).toBe("777 Real St, Calamba City, Laguna");
    expect(dbProfile!.emergencyContactName).toBe("Teodora Alonso");
    expect(dbProfile!.emergencyContactPhone).toBe("09170001122");
    expect(dbProfile!.emergencyContactRelationship).toBe("Mother");
    expect(dbProfile!.emergencyContactAddress).toBe("Calamba, Laguna");
  });

  it("rejects interview scheduling with a past date or invalid date format", async () => {
    await expect(
      scheduleNewInterview(1, "INITIAL_SCREENING", "invalid-date-string")
    ).rejects.toThrow("Invalid scheduledAt format");

    await expect(
      scheduleNewInterview(1, "INITIAL_SCREENING", "2020-01-01T10:00:00.000Z")
    ).rejects.toThrow("Cannot schedule an interview in the past. Please select a future date and time.");

    // Date more than 5 minutes ago should be rejected
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    await expect(
      scheduleNewInterview(1, "INITIAL_SCREENING", sixMinutesAgo)
    ).rejects.toThrow("Cannot schedule an interview in the past. Please select a future date and time.");
  });
});
