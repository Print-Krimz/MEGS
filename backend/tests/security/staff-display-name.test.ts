import { describe, it, expect, vi } from "vitest";
const db = vi.hoisted(() => ({ user: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() }, client: { findMany: vi.fn() }, manpowerRequest: { findMany: vi.fn() }, jobPosting: { findMany: vi.fn() }, userInvitation: { updateMany: vi.fn(), create: vi.fn() } }));
vi.mock("../../src/utils/prisma.js", () => ({ default: db }));
vi.mock("../../src/utils/supabase.js", () => ({ default: { auth: { admin: { createUser: vi.fn().mockResolvedValue({ data: { user: { id: "new", email: "a@example.com" } }, error: null }) } } } }));
vi.mock("../../src/utils/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock("../../src/utils/mailer.js", () => ({ sendMail: vi.fn(), sendTAInvitationEmail: vi.fn() }));
import { inviteTA, buildAdminUserSearchFilter } from "../../src/services/admin/admin.service.js";
import { getAnalyticsFilterOptions } from "../../src/services/analytics/analytics.service.js";
import { resolveUserName } from "../../src/utils/user-name.js";
describe("staff display names", () => {
  it("persists trimmed invitation names and preserves omitted names", async () => {
    db.user.findUnique.mockResolvedValueOnce(null); db.user.create.mockResolvedValue({ id: "new", email: "a@example.com" });
    await inviteTA("admin", "a@example.com", "  Ana ", " Cruz  ");
    expect(db.user.create.mock.calls[0][0].data.displayName).toBe("Ana Cruz");
    db.user.findUnique.mockResolvedValueOnce({ id: "existing", role: "TALENT_ACQUISITION", accountStatus: "PENDING" }); db.user.update.mockResolvedValue({ id: "existing", email: "a@example.com" });
    await inviteTA("admin", "a@example.com", " ", " ");
    expect(db.user.update.mock.calls[0][0].data).not.toHaveProperty("displayName");
    db.user.findUnique.mockResolvedValueOnce({ id: "existing", role: "TALENT_ACQUISITION", accountStatus: "PENDING" });
    await inviteTA("admin", "a@example.com", " Ana ", " Cruz ");
    expect(db.user.update.mock.calls[1][0].data.displayName).toBe("Ana Cruz");
  });
  it("searches full staff name and preserves candidate priority", () => {
    expect(buildAdminUserSearchFilter("Ana Cruz").OR).toContainEqual({ displayName: { contains: "Ana Cruz", mode: "insensitive" } });
    const u = { displayName: "Staff Name", email: "a@example.com", applicantProfile: { firstName: "Ana", lastName: "Cruz" } };
    expect(resolveUserName({ ...u, role: "APPLICANT" })).toBe("Ana Cruz");
    expect(resolveUserName({ ...u, role: "TALENT_ACQUISITION" })).toBe("Staff Name");
  });
  it("uses the saved recruiter name in filter options without changing IDs", async () => {
    db.client.findMany.mockResolvedValue([]); db.manpowerRequest.findMany.mockResolvedValue([]); db.jobPosting.findMany.mockResolvedValue([]);
    db.user.findMany.mockResolvedValue([{ id: "ta-uuid", role: "TALENT_ACQUISITION", displayName: "Ana Cruz", email: "ana@example.com", applicantProfile: null }]);
    const options = await getAnalyticsFilterOptions("ADMINISTRATOR");
    expect(options.recruiters).toEqual([{ id: "ta-uuid", name: "Ana Cruz", email: "ana@example.com" }]);
  });

});
