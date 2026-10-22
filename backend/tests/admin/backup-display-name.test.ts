import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(), update: vi.fn(), storageFrom: vi.fn(), download: vi.fn(), logAudit: vi.fn(),
}));
vi.mock("../../src/utils/prisma.js", () => ({ default: {
  databaseBackupRecord: { findUnique: mocks.findUnique, update: mocks.update },
} }));
vi.mock("../../src/utils/supabase.js", () => ({ default: { storage: { from: mocks.storageFrom } } }));
vi.mock("../../src/utils/audit.js", () => ({ logAudit: mocks.logAudit }));

import { getBackupDownloadStream, renameDatabaseBackup } from "../../src/services/admin/backup.service.js";

const record = {
  id: "backup-1", displayName: "Before hiring", filename: "megs_backup_internal.enc.gz",
  storagePath: "original/path.enc.gz", status: "SUCCESS", sizeBytes: 12n, checksumSha256: "checksum",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findUnique.mockResolvedValue({ ...record });
  mocks.update.mockImplementation(async ({ data }) => ({ ...record, ...data }));
  mocks.logAudit.mockResolvedValue(undefined);
  mocks.storageFrom.mockReturnValue({ download: mocks.download });
  mocks.download.mockResolvedValue({ data: { arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } });
});

describe("backup display names", () => {
  it("renames only the label and never moves or replaces a recovery file", async () => {
    const updated = await renameDatabaseBackup(record.id, " October hiring checkpoint ", "admin-1");
    expect(updated.displayName).toBe("October hiring checkpoint");
    expect(updated.filename).toBe(record.filename);
    expect(updated.storagePath).toBe(record.storagePath);
    expect(mocks.update.mock.calls[0][0].data).toEqual({ displayName: "October hiring checkpoint" });
    expect(mocks.storageFrom).not.toHaveBeenCalled();
    expect(mocks.logAudit).toHaveBeenCalledWith("admin-1", "DATABASE_BACKUP_RENAMED", "DatabaseBackupRecord", record.id,
      { oldDisplayName: "Before hiring", newDisplayName: "October hiring checkpoint" });
  });

  it("downloads the original stored file under a friendly filename", async () => {
    const result = await getBackupDownloadStream(record.id, "admin-1");
    expect(mocks.download).toHaveBeenCalledWith(record.storagePath);
    expect(result.filename).toBe("Before_hiring.enc.gz");
    expect(result.sizeBytes).toBe(3);
  });

  it("does not access storage for an unknown backup", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(renameDatabaseBackup("missing", "New name")).rejects.toThrow("not found");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.storageFrom).not.toHaveBeenCalled();
  });
});
