import { describe, expect, it, vi } from "vitest";
vi.mock("../../src/utils/prisma.js", () => ({ default: {} }));
import { settingsSchema } from "../../src/schemas/settings.schema.js";
import { staffDisplayNameSchema } from "../../../frontend/src/lib/user-name.js";
describe("staff name validation parity", () => {
  it.each(["李 明", "  María O’Neil  ", "a".repeat(201), "", "   ", "a\tb", "a\u2028b", "a".repeat(202), "<script>", "javascript:alert(1)", "DROP TABLE users"])("matches the backend for %j", (displayName) => {
    const backend = settingsSchema.profile.safeParse({ body: { displayName } });
    const frontend = staffDisplayNameSchema.safeParse(displayName);
    expect(frontend.success).toBe(backend.success);
    if (frontend.success && backend.success) expect(frontend.data).toBe(backend.data.body.displayName);
  });
});
