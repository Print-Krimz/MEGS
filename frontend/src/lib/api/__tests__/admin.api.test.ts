import { describe, it, expect, vi, beforeEach } from "vitest";
import { adminApi } from "../admin.api";
import { api } from "../client";
import { Role } from "../../types/enums";

vi.mock("../client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("Admin API Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists all users", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([{ id: "u-1", email: "admin@megs.ph", role: Role.ADMINISTRATOR }]);
    const result = await adminApi.listUsers();
    expect(api.get).toHaveBeenCalledWith("/api/admin/users");
    expect(result).toHaveLength(1);
  });

  it("invites a new TA specialist", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ id: "u-2", email: "ta@megs.ph" });
    await adminApi.inviteTA({ email: "ta@megs.ph", firstName: "Jane", lastName: "Doe" });
    expect(api.post).toHaveBeenCalledWith("/api/admin/invite-ta", {
      email: "ta@megs.ph",
      firstName: "Jane",
      lastName: "Doe",
    });
  });

  it("updates user role", async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ id: "u-2", role: Role.TALENT_ACQUISITION });
    await adminApi.updateUserRole("u-2", Role.TALENT_ACQUISITION);
    expect(api.patch).toHaveBeenCalledWith("/api/admin/users/u-2/role", {
      role: Role.TALENT_ACQUISITION,
    });
  });

  it("updates user active status", async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ id: "u-2", isActive: false });
    await adminApi.updateUserStatus("u-2", false);
    expect(api.patch).toHaveBeenCalledWith("/api/admin/users/u-2/status", {
      isActive: false,
    });
  });

  it("fetches active scoring configuration", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ id: 1, revision: 3, weights: { SKILLS: 30 } });
    const result = await adminApi.getScoringConfig();
    expect(api.get).toHaveBeenCalledWith("/api/admin/candidate-scoring/configuration");
    expect(result.revision).toBe(3);
  });

  it("updates scoring configuration with revision lock", async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ id: 1, revision: 4 });
    await adminApi.updateScoringConfig({
      expectedRevision: 3,
      weights: {
        SKILLS: 30,
        EXPERIENCE: 25,
        LOCATION: 15,
        COMPLIANCE: 15,
        EDUCATION_CERTIFICATIONS: 15,
      },
    });
    expect(api.put).toHaveBeenCalledWith(
      "/api/admin/candidate-scoring/configuration",
      expect.objectContaining({ expectedRevision: 3 })
    );
  });

  it("restores default scoring configuration", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ id: 1, revision: 5 });
    await adminApi.restoreDefaultScoringConfig(4);
    expect(api.post).toHaveBeenCalledWith(
      "/api/admin/candidate-scoring/configuration/restore-defaults",
      { expectedRevision: 4 }
    );
  });

  it("fetches scoring revalidation status", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ counts: { PENDING: 5, PROCESSING: 2, COMPLETED: 100, FAILED: 1 }, failures: [] });
    const result = await adminApi.getRevalidationStatus();
    expect(api.get).toHaveBeenCalledWith("/api/admin/candidate-scoring/revalidation-status");
    expect(result.counts.PENDING).toBe(5);
  });

  it("fetches scoring quality metrics", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ totalCalculated: 120, averageFitScore: 78.4 });
    const result = await adminApi.getQualityMetrics();
    expect(api.get).toHaveBeenCalledWith("/api/admin/candidate-scoring/quality-metrics");
    expect(result.totalCalculated).toBe(120);
  });

  it("queries audit logs with filters", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([{ id: 1, action: "USER_INVITED" }]);
    await adminApi.listAuditLogs({ action: "USER_INVITED", limit: 20 });
    expect(api.get).toHaveBeenCalledWith("/api/admin/audit-logs?action=USER_INVITED&limit=20");
  });
});
