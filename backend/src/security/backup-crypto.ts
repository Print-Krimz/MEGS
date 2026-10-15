import crypto from "crypto";

const FORMAT_MAGIC = Buffer.from("MEGSBKP2", "ascii");
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const deriveKey = (secret: string): Buffer =>
  crypto.createHash("sha256").update(secret, "utf8").digest();

const requireStrongSecret = (secret: string | undefined, name: string): string => {
  if (secret && secret.trim().length >= 32) {
    return secret;
  }
  throw new Error(`${name} must be configured with at least 32 characters`);
};

const decryptWithSecret = (
  encryptedPayload: Buffer,
  iv: Buffer,
  authTag: Buffer,
  secret: string
): Buffer => {
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(secret), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encryptedPayload), decipher.final()]);
};

const currentKey = (): { id: string; secret: string } => {
  const id = (process.env.BACKUP_ENCRYPTION_KEY_ID || "v1").trim();
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(id)) {
    throw new Error("BACKUP_ENCRYPTION_KEY_ID must be 1-64 safe characters");
  }
  return {
    id,
    secret: requireStrongSecret(
      process.env.BACKUP_ENCRYPTION_SECRET,
      "BACKUP_ENCRYPTION_SECRET"
    ),
  };
};

// Decryption-only keys may be weak historical values. Never use them for new writes.
// Arrays preserve backups written with different secrets under the same old key ID.
const legacyKeyMap = (): Record<string, string[]> => {
  const raw = process.env.BACKUP_ENCRYPTION_LEGACY_KEYS;
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    const entries = Object.entries(parsed);
    if (entries.length > 32) throw new Error();
    return Object.fromEntries(entries.map(([id, value]) => {
      const secrets = Array.isArray(value) ? value : [value];
      if (!/^[A-Za-z0-9._-]{1,64}$/.test(id) || secrets.length < 1 || secrets.length > 8 ||
          !secrets.every((secret) => typeof secret === "string" && secret.length > 0 && secret.length <= 4096)) {
        throw new Error();
      }
      return [id, [...new Set(secrets as string[])]];
    }));
  } catch {
    throw new Error("BACKUP_ENCRYPTION_LEGACY_KEYS must map safe key IDs to a secret or up to 8 secrets (maximum 32 IDs)");
  }
};

const legacyRawSecrets = (): string[] => {
  const values = [process.env.BACKUP_ENCRYPTION_SECRET];
  if (process.env.BACKUP_ENCRYPTION_LEGACY_SECRETS) {
    values.push(...process.env.BACKUP_ENCRYPTION_LEGACY_SECRETS.split(","));
  }
  const secrets = [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
  if (secrets.length > 32 || secrets.some((secret) => secret.length > 4096)) {
    throw new Error("BACKUP_ENCRYPTION_LEGACY_SECRETS exceeds the supported key limits");
  }
  return secrets;
};

export const encryptBackupPayload = (plain: Buffer): Buffer => {
  const key = currentKey();
  const keyId = Buffer.from(key.id, "utf8");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(key.secret), iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([
    FORMAT_MAGIC,
    Buffer.from([keyId.length]),
    keyId,
    iv,
    authTag,
    encrypted,
  ]);
};

export const decryptBackupPayload = (buffer: Buffer): Buffer => {
  if (buffer.subarray(0, FORMAT_MAGIC.length).equals(FORMAT_MAGIC)) {
    const keyIdLength = buffer[FORMAT_MAGIC.length];
    const metadataLength = FORMAT_MAGIC.length + 1 + keyIdLength;
    if (!keyIdLength || keyIdLength > 64 || buffer.length < metadataLength + IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error("Invalid versioned backup format");
    }

    const keyId = buffer
      .subarray(FORMAT_MAGIC.length + 1, metadataLength)
      .toString("utf8");
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(keyId)) throw new Error("Invalid versioned backup key ID");
    const legacyKeys = legacyKeyMap();
    const secrets = Object.hasOwn(legacyKeys, keyId) ? legacyKeys[keyId] : [];
    if (process.env.BACKUP_ENCRYPTION_SECRET) {
      const configured = currentKey();
      if (keyId === configured.id) secrets.unshift(configured.secret);
    }
    if (!secrets.length) throw new Error("No backup decryption key configured for this key ID");

    const iv = buffer.subarray(metadataLength, metadataLength + IV_LENGTH);
    const authTag = buffer.subarray(
      metadataLength + IV_LENGTH,
      metadataLength + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const encrypted = buffer.subarray(metadataLength + IV_LENGTH + AUTH_TAG_LENGTH);
    for (const secret of [...new Set(secrets)]) {
      try {
        return decryptWithSecret(encrypted, iv, authTag, secret);
      } catch {
        // An old deployment may have reused this ID after a master credential change.
      }
    }
    throw new Error("Unable to decrypt versioned backup with configured keys");
  }

  if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid legacy backup format");
  }

  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  for (const secret of legacyRawSecrets()) {
    try {
      return decryptWithSecret(encrypted, iv, authTag, secret);
    } catch {
      // Try the next explicitly configured legacy key.
    }
  }
  throw new Error("Unable to decrypt legacy backup with configured keys");
};
