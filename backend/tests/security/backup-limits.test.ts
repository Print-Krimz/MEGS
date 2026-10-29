import { describe, expect, it } from "vitest";
import {
  MAX_BACKUP_BYTES,
  MAX_BACKUP_EXPANDED_BYTES,
  MAX_BACKUP_RECORDS,
  assertBackupExpandedSize,
  assertBackupFileSize,
  assertBackupRecordCount,
  validateBackupStructure,
} from "../../src/security/backup-limits.js";

describe("backup creation limits match restore validation", () => {
  it("uses the documented limits", () => {
    expect(MAX_BACKUP_RECORDS).toBe(250_000);
    expect(MAX_BACKUP_EXPANDED_BYTES).toBe(128 * 1024 * 1024);
    expect(MAX_BACKUP_BYTES).toBe(50 * 1024 * 1024);
  });

  it.each([
    ["records", assertBackupRecordCount, MAX_BACKUP_RECORDS],
    ["expanded JSON", assertBackupExpandedSize, MAX_BACKUP_EXPANDED_BYTES],
    ["encrypted file", assertBackupFileSize, MAX_BACKUP_BYTES],
  ] as const)("accepts below and at the %s limit and rejects above it", (_name, assertFn, limit) => {
    expect(() => assertFn(limit - 1)).not.toThrow();
    expect(() => assertFn(limit)).not.toThrow();
    expect(() => assertFn(limit + 1)).toThrow(/No backup was saved/);
  });

  it("restore validation agrees on the record boundary", () => {
    const snapshot = (count: number) => ({ meta: {}, data: { notifications: Array.from({ length: count }, () => ({})) } });
    expect(() => validateBackupStructure(snapshot(MAX_BACKUP_RECORDS))).not.toThrow();
    expect(() => validateBackupStructure(snapshot(MAX_BACKUP_RECORDS + 1))).toThrow();
  });
});
