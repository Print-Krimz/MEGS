import { describe, expect, it } from "vitest";
import { canOpenPath, getHomePath } from "../home-path";

const admin = { role: "ADMINISTRATOR" };
const ta = { role: "TALENT_ACQUISITION" };
const applicant = { role: "APPLICANT" };

describe("canOpenPath", () => {
  it("allows a role into its own area only", () => {
    expect(canOpenPath(ta, "/ta/applications/12")).toBe(true);
    expect(canOpenPath(admin, "/ta/applications/12")).toBe(false);
    expect(canOpenPath(applicant, "/admin")).toBe(false);
    expect(canOpenPath(admin, "/admin/users")).toBe(true);
    expect(canOpenPath(applicant, "/app")).toBe(true);
  });

  it("allows paths that are not a role area, and does not mistake a longer name for an area", () => {
    expect(canOpenPath(admin, "/change-password")).toBe(true);
    expect(canOpenPath(applicant, "/tasks")).toBe(true);
    expect(canOpenPath(applicant, "/application-form")).toBe(true);
  });

  it("sends each role home", () => {
    expect(getHomePath(ta)).toBe("/ta");
  });
});
