import { describe, expect, it } from "vitest";
import { router } from "./routes";

describe("role settings routes", () => {
  it("registers one guarded settings path inside each role portal", () => {
    expect(Object.keys(router.routesByPath)).toEqual(
      expect.arrayContaining(["/app/settings", "/ta/settings", "/admin/settings"]),
    );
  });
});
