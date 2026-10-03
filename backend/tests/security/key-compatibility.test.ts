import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../src/utils/env.js", () => ({}));
import { hashOtp, verifyOtpHash } from "../../src/utils/otp.js";
import { decryptBackupPayload, encryptBackupPayload } from "../../src/security/backup-crypto.js";

const CURRENT_SECRET = "synthetic-dedicated-key-at-least-32-characters";
const OLD_SECRET = "synthetic-previous-key-at-least-32-characters";

// Independently reconstruct both historical formats; no application encoder is
// used to create old fixtures, and no real backup or secret is read.
const historicalBackup = (plain: Buffer, secret: string, id?: string): Buffer => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", crypto.createHash("sha256").update(secret).digest(), iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const payload = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
  return id === undefined ? payload : Buffer.concat([Buffer.from("MEGSBKP2"), Buffer.from([Buffer.byteLength(id)]), Buffer.from(id), payload]);
};

describe("dedicated keys and historical backup recovery", () => {
  beforeEach(() => {
    for (const name of ["OTP_SECRET", "BACKUP_ENCRYPTION_SECRET", "BACKUP_ENCRYPTION_KEY_ID", "BACKUP_ENCRYPTION_LEGACY_KEYS", "BACKUP_ENCRYPTION_LEGACY_SECRETS"]) vi.stubEnv(name, "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "synthetic-master-credential-never-used-as-a-fallback");
    vi.stubEnv("DATABASE_URL", "postgresql://synthetic.invalid/not-a-real-database");
    vi.stubEnv("JWT_SECRET", "synthetic-legacy-jwt-key");
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(["production", "development", "test"])("requires explicit OTP and new-backup keys in %s", (mode) => {
    vi.stubEnv("NODE_ENV", mode);
    expect(() => hashOtp("123456")).toThrow("OTP_SECRET");
    expect(() => encryptBackupPayload(Buffer.from("payload"))).toThrow("BACKUP_ENCRYPTION_SECRET");
    vi.stubEnv("OTP_SECRET", "short-key");
    vi.stubEnv("BACKUP_ENCRYPTION_SECRET", "short-key");
    expect(() => hashOtp("123456")).toThrow("OTP_SECRET");
    expect(() => encryptBackupPayload(Buffer.from("payload"))).toThrow("BACKUP_ENCRYPTION_SECRET");
  });

  it("rejects blank secrets even when their untrimmed length exceeds the minimum", () => {
    vi.stubEnv("OTP_SECRET", " ".repeat(40));
    vi.stubEnv("BACKUP_ENCRYPTION_SECRET", " ".repeat(40));
    expect(() => hashOtp("123456")).toThrow("OTP_SECRET");
    expect(() => encryptBackupPayload(Buffer.from("payload"))).toThrow("BACKUP_ENCRYPTION_SECRET");
  });

  it("retains OTP verification and backup recovery when unrelated credentials rotate", () => {
    vi.stubEnv("OTP_SECRET", CURRENT_SECRET);
    vi.stubEnv("BACKUP_ENCRYPTION_SECRET", CURRENT_SECRET);
    const hash = hashOtp("123456");
    const backup = encryptBackupPayload(Buffer.from("dedicated-key backup"));
    vi.stubEnv("SUPABASE_SECRET_KEY", "replacement-master-key");
    vi.stubEnv("DATABASE_URL", "replacement-connection-string");
    expect(verifyOtpHash("123456", hash)).toBe(true);
    expect(verifyOtpHash("654321", hash)).toBe(false);
    expect(decryptBackupPayload(backup).toString()).toBe("dedicated-key backup");
  });

  it("recovers original raw backups only with explicitly retained historical values", () => {
    const fixture = historicalBackup(Buffer.from("original backup"), "short-old-jwt-key");
    expect(() => decryptBackupPayload(fixture)).toThrow("legacy backup");
    vi.stubEnv("BACKUP_ENCRYPTION_LEGACY_SECRETS", "short-old-jwt-key");
    expect(decryptBackupPayload(fixture).toString()).toBe("original backup");
    expect(() => encryptBackupPayload(Buffer.from("new backup"))).toThrow("BACKUP_ENCRYPTION_SECRET");
  });

  it("recovers pre-fallback versioned backups by historical ID without a new-write key", () => {
    const fixture = historicalBackup(Buffer.from("v1 explicit backup"), OLD_SECRET, "v1");
    vi.stubEnv("BACKUP_ENCRYPTION_LEGACY_KEYS", JSON.stringify({ v1: OLD_SECRET }));
    expect(decryptBackupPayload(fixture).toString()).toBe("v1 explicit backup");
  });

  it("recovers different fallback-derived secrets written under the same v1 ID", () => {
    const deriveHistoricalFallback = (master: string) => crypto.createHmac("sha256", "megs-BACKUP_ENCRYPTION_SECRET-v1").update(master).digest("hex");
    const oldDerived = deriveHistoricalFallback("synthetic-old-master");
    const otherDerived = deriveHistoricalFallback("synthetic-next-master");
    const fixtures = [
      historicalBackup(Buffer.from("explicit version"), OLD_SECRET, "v1"),
      historicalBackup(Buffer.from("first derived version"), oldDerived, "v1"),
      historicalBackup(Buffer.from("second derived version"), otherDerived, "v1"),
    ];
    vi.stubEnv("BACKUP_ENCRYPTION_SECRET", CURRENT_SECRET);
    vi.stubEnv("BACKUP_ENCRYPTION_KEY_ID", "v1");
    vi.stubEnv("BACKUP_ENCRYPTION_LEGACY_KEYS", JSON.stringify({ v1: [OLD_SECRET, oldDerived, otherDerived] }));
    expect(fixtures.map((fixture) => decryptBackupPayload(fixture).toString())).toEqual(["explicit version", "first derived version", "second derived version"]);
    expect(decryptBackupPayload(encryptBackupPayload(Buffer.from("current version"))).toString()).toBe("current version");
  });

  it("rejects tampering even when several candidate keys are configured", () => {
    const fixture = historicalBackup(Buffer.from("authenticated payload"), OLD_SECRET, "v1");
    vi.stubEnv("BACKUP_ENCRYPTION_LEGACY_KEYS", JSON.stringify({ v1: [CURRENT_SECRET, OLD_SECRET] }));
    fixture[fixture.length - 1] ^= 1;
    expect(() => decryptBackupPayload(fixture)).toThrow("Unable to decrypt");
  });

  it.each(["[]", "null", '{"v1":null}', '{"v1":[]}', '{"v1":[""]}', '{"bad/key":"secret"}'])("rejects malformed legacy key config %s", (config) => {
    vi.stubEnv("BACKUP_ENCRYPTION_LEGACY_KEYS", config);
    expect(() => decryptBackupPayload(historicalBackup(Buffer.from("payload"), OLD_SECRET, "v1"))).toThrow("BACKUP_ENCRYPTION_LEGACY_KEYS");
  });

  it("rejects unknown key IDs and malformed envelopes without exposing config", () => {
    vi.stubEnv("BACKUP_ENCRYPTION_SECRET", CURRENT_SECRET);
    vi.stubEnv("BACKUP_ENCRYPTION_KEY_ID", "v2");
    expect(() => decryptBackupPayload(historicalBackup(Buffer.from("payload"), OLD_SECRET, "unknown"))).toThrow("No backup decryption key");
    expect(() => decryptBackupPayload(Buffer.from("MEGSBKP2"))).toThrow("Invalid versioned backup format");
    expect(() => decryptBackupPayload(Buffer.alloc(27))).toThrow("Invalid legacy backup format");
    expect(() => decryptBackupPayload(historicalBackup(Buffer.from("payload"), OLD_SECRET, "constructor"))).toThrow("No backup decryption key");
  });

  it("round-trips empty authenticated payloads", () => {
    vi.stubEnv("BACKUP_ENCRYPTION_SECRET", CURRENT_SECRET);
    expect(decryptBackupPayload(encryptBackupPayload(Buffer.alloc(0)))).toEqual(Buffer.alloc(0));
  });
});
