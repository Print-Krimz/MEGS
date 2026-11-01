import { describe, it, expect, vi } from "vitest";
vi.mock("../../src/utils/prisma.js", () => ({ default: {} }));
import { settingsSchema } from "../../src/schemas/settings.schema.js";
import { resolveUserName } from "../../src/utils/user-name.js";
describe("settings input and identity", () => {
  it("rejects a forged identity", () => expect(settingsSchema.profile.safeParse({ body: { displayName: "Ada", id: "other" } }).success).toBe(false));
  it("accepts international names and 201 characters, rejecting controls and longer names", () => {
    for (const displayName of ["  李 明  ", "a".repeat(201)]) expect(settingsSchema.profile.safeParse({ body: { displayName } }).success).toBe(true);
    for (const displayName of ["a\u0000b", "a\nb", " Ada\t", "a\u2028b", "a".repeat(202)]) expect(settingsSchema.profile.safeParse({ body: { displayName } }).success).toBe(false);
  });
  it("ignores applicant displayName and prefers staff displayName", () => {
    const user = { displayName: "Staff", email: "a@example.com", applicantProfile: { firstName: "李", lastName: "明" } };
    expect(resolveUserName({ ...user, role: "APPLICANT" })).toBe("李 明");
    expect(resolveUserName({ ...user, role: "TALENT_ACQUISITION" })).toBe("Staff");
  });
});
