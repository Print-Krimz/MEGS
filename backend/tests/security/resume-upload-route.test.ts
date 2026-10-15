import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
const state = vi.hoisted(() => ({ role: "APPLICANT", parsed: 0 }));
vi.mock("../../src/security/auth-token.js", () => ({ verifyAccessToken: vi.fn().mockResolvedValue({ sub: "owner", aal: "aal2" }) }));
vi.mock("../../src/security/session-revocation.js", () => ({ isSessionRevoked: vi.fn().mockResolvedValue(false) }));
vi.mock("../../src/security/security-controls.js", () => ({ getSecurityControls: async () => ({ mfaDisabled: false }) }));
vi.mock("../../src/utils/prisma.js", () => ({ default: { user: { findUnique: async () => ({
  id: "owner", role: state.role, email: "demo@example.test", isActive: true, accountStatus: "ACTIVE", mustChangePassword: false,
}) } } }));
vi.mock("../../src/utils/supabase.js", () => ({ default: {} }));
vi.mock("../../src/controllers/applicant/applicant.controller.js", () => {
  const noop = (_req: any, res: any) => res.json({ success: true });
  return Object.fromEntries([
    "getProfile", "upsertProfile", "addWorkExperience", "deleteWorkExperience", "addEducation", "deleteEducation",
    "updateSkills", "addTraining", "deleteTraining", "addReference", "deleteReference", "addAsset", "deleteAsset",
    "uploadPhoto", "applyExtractedProfile", "uploadResume",
  ].map(name => [name, name === "uploadResume" ? (req: any, res: any) => {
    state.parsed++; res.json({ success: true, data: { extractionStatus: "SUCCESS", size: req.file.buffer.length } });
  } : noop]));
});
import applicantRoutes from "../../src/routes/applicant/applicant.routes.js";
const app = express().use(express.json()).use("/api/applicants", applicantRoutes);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAE0lEQVR4nGP8//8/AwMDEwMYAAAkBgMBXaJOiAAAAABJRU5ErkJggg==", "base64");
describe("resume HTTP admission through actual auth and upload validation", () => {
  beforeEach(() => { state.role = "APPLICANT"; state.parsed = 0; });
  it("admits 50 sequential uploads for the same authenticated user and IP without a quota rejection", async () => {
    for (let i = 1; i <= 50; i++) {
      const result = await request(app).post("/api/applicants/profile/resume").set("Authorization", "Bearer verified")
        .attach("file", png, { filename: `resume-${i}.png`, contentType: "image/png" });
      expect(result.status, `resume ${i}`).toBe(200);
      expect(result.body.data.extractionStatus).toBe("SUCCESS");
    }
    expect(state.parsed).toBe(50);
  });
  it("retains authentication, role permissions and byte validation", async () => {
    expect((await request(app).post("/api/applicants/profile/resume").attach("file", png, "resume.png")).status).toBe(401);
    state.role = "TALENT_ACQUISITION";
    expect((await request(app).post("/api/applicants/profile/resume").set("Authorization", "Bearer verified").attach("file", png, "resume.png")).status).toBe(403);
    state.role = "APPLICANT";
    expect((await request(app).post("/api/applicants/profile/resume").set("Authorization", "Bearer verified")
      .attach("file", Buffer.from("not a PNG"), { filename: "fake.png", contentType: "image/png" })).status).toBe(400);
    expect(state.parsed).toBe(0);
  });
});
