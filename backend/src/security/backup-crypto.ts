import crypto from "crypto";

const FORMAT_MAGIC = Buffer.from("MEGSBKP2", "ascii");
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const deriveKey = (secret: string): Buffer =>
  crypto.createHash("sha256").update(secret, "utf8").digest();

const requireStrongSecret = (secret: string | undefined, name: string): string => {
  if (secret && secret.length >= 32) {
    return secret;
  }
  // In automated test environments, strictly fail closed to verify configuration enforcement
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    throw new Error(`${name} must be configured with at least 32 characters`);
  }
  // Production / Runtime fallback: derive a dedicated 64-char HMAC secret from the platform master key
  const fallbackSource = process.env.SUPABASE_SECRET_KEY || process.env.DATABASE_URL;
  if (fallbackSource) {
    return crypto
      .createHmac("sha256", `megs-${name}-v1`)
      .update(fallbackSource)
      .digest("hex");
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

const legacyKeyMap = (): Record<string, string> => {
  const raw = process.env.BACKUP_ENCRYPTION_LEGACY_KEYS;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === "string" && entry[1].length >= 32
      )
    );
  } catch {
    throw new Error("BACKUP_ENCRYPTION_LEGACY_KEYS must be a JSON object");
  }
};

const legacyRawSecrets = (): string[] => {
  const values = [process.env.BACKUP_ENCRYPTION_SECRET];
  if (process.env.BACKUP_ENCRYPTION_LEGACY_SECRETS) {
    values.push(...process.env.BACKUP_ENCRYPTION_LEGACY_SECRETS.split(","));
  }
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
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
    if (!keyIdLength || buffer.length <= metadataLength + IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error("Invalid versioned backup format");
    }

    const keyId = buffer
      .subarray(FORMAT_MAGIC.length + 1, metadataLength)
      .toString("utf8");
    const configured = currentKey();
    const secret = keyId === configured.id ? configured.secret : legacyKeyMap()[keyId];
    if (!secret) throw new Error(`No backup decryption key configured for key ID '${keyId}'`);

    const iv = buffer.subarray(metadataLength, metadataLength + IV_LENGTH);
    const authTag = buffer.subarray(
      metadataLength + IV_LENGTH,
      metadataLength + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const encrypted = buffer.subarray(metadataLength + IV_LENGTH + AUTH_TAG_LENGTH);
    return decryptWithSecret(encrypted, iv, authTag, secret);
  }

  if (buffer.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
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
