import crypto from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  decryptBackupPayload,
  encryptBackupPayload,
} from "../../src/security/backup-crypto.js";

const OLD_SECRET = "old-backup-secret-that-is-at-least-32-characters";
const NEW_SECRET = "new-backup-secret-that-is-at-least-32-characters";

const legacyEncrypt = (plain: Buffer, secret: string): Buffer => {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(secret).digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
};

describe("versioned backup encryption", () => {
  afterEach(() => {
    delete process.env.BACKUP_ENCRYPTION_SECRET;
    delete process.env.BACKUP_ENCRYPTION_KEY_ID;
    delete process.env.BACKUP_ENCRYPTION_LEGACY_KEYS;
    delete process.env.BACKUP_ENCRYPTION_LEGACY_SECRETS;
  });

  it("round-trips a versioned backup and rejects tampering", () => {
    process.env.BACKUP_ENCRYPTION_SECRET = OLD_SECRET;
    process.env.BACKUP_ENCRYPTION_KEY_ID = "v1";
    const encrypted = encryptBackupPayload(Buffer.from("backup payload"));
    expect(decryptBackupPayload(encrypted).toString()).toBe("backup payload");

    encrypted[encrypted.length - 1] ^= 1;
    expect(() => decryptBackupPayload(encrypted)).toThrow();
  });

  it("decrypts a prior version after key rotation", () => {
    process.env.BACKUP_ENCRYPTION_SECRET = OLD_SECRET;
    process.env.BACKUP_ENCRYPTION_KEY_ID = "v1";
    const encrypted = encryptBackupPayload(Buffer.from("old payload"));

    process.env.BACKUP_ENCRYPTION_SECRET = NEW_SECRET;
    process.env.BACKUP_ENCRYPTION_KEY_ID = "v2";
    process.env.BACKUP_ENCRYPTION_LEGACY_KEYS = JSON.stringify({ v1: OLD_SECRET });
    expect(decryptBackupPayload(encrypted).toString()).toBe("old payload");
  });

  it("requires an explicit legacy secret for pre-versioned backups", () => {
    const encrypted = legacyEncrypt(Buffer.from("legacy payload"), OLD_SECRET);
    expect(() => decryptBackupPayload(encrypted)).toThrow();
    process.env.BACKUP_ENCRYPTION_LEGACY_SECRETS = OLD_SECRET;
    expect(decryptBackupPayload(encrypted).toString()).toBe("legacy payload");
  });

  it("fails closed when the current encryption secret is absent", () => {
    expect(() => encryptBackupPayload(Buffer.from("payload"))).toThrow(
      "BACKUP_ENCRYPTION_SECRET"
    );
  });
});
