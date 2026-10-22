import { describe, expect, it } from "vitest";
import { formatAction } from "../../lib/utils/audit-formatter";
import { backupDisplayName, backupDownloadName } from "../../lib/backup-name";

describe("administrator display names", () => {
  it.each(["MFA_ENABLED", "MFA_CHALLENGE_FAILED", "USER_MFA_RESET", "mfa_verified"])("capitalizes MFA in %s", (action) => {
    expect(formatAction(action)).toContain("MFA");
    expect(formatAction(action)).not.toContain("Mfa");
  });

  it("shows the custom backup name unchanged", () => {
    expect(backupDisplayName({ displayName: "Before October hiring", createdAt: "2026-10-22T12:30:00Z" })).toBe("Before October hiring");
  });

  it("gives older backups a date label without exposing the storage filename", () => {
    expect(backupDisplayName({ displayName: null, createdAt: "2026-10-22T12:30:00Z" })).toMatch(/^Backup .*2026/);
  });

  it("keeps downloaded names safe and preserves the recovery format", () => {
    expect(backupDownloadName({ displayName: 'October / "Hiring"', createdAt: "2026-10-22T12:30:00Z" })).toBe("October_Hiring.enc.gz");
  });
});
