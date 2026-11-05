import prisma from "./prisma.js";

// Sensitive keys to automatically redact from audit payloads
const SENSITIVE_KEYS = new Set([
  "password",
  "newpassword",
  "currentpassword",
  "temppassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "resettoken",
  "setuptoken",
  "secret",
  "apikey",
  "otp",
  "authorization",
]);

const sanitizeDetails = (obj: any): any => {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeDetails);

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      clean[key] = "[REDACTED]";
    } else if (value && typeof value === "object") {
      clean[key] = sanitizeDetails(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
};

// Fire-and-forget audit logger. Swallows write errors to prevent blocking the primary transaction.
export const logAudit = async (
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string | number | null,
  details?: Record<string, any>
): Promise<void> => {
  try {
    let parsedEntityId: number | null = null;
    const sanitized = sanitizeDetails(details || {});

    if (typeof entityId === "number") {
      parsedEntityId = isNaN(entityId) ? null : entityId;
    } else if (typeof entityId === "string" && entityId.trim()) {
      const num = parseInt(entityId, 10);
      if (!isNaN(num) && String(num) === entityId.trim()) {
        parsedEntityId = num;
      } else {
        // String or UUID entity ID — preserve in sanitized details
        sanitized.targetEntityId = entityId;
      }
    }

    if (!prisma?.auditLog?.create) {
      return;
    }

    try {
      await prisma.auditLog.create({
        data: {
          userId: userId || null,
          action,
          entity: entity || null,
          entityId: parsedEntityId,
          details: JSON.stringify(sanitized),
        },
      });
    } catch (createErr: any) {
      if (createErr?.code === "P2003" && userId) {
        sanitized.actorId = userId;
        await prisma.auditLog.create({
          data: {
            userId: null,
            action,
            entity: entity || null,
            entityId: parsedEntityId,
            details: JSON.stringify(sanitized),
          },
        }).catch(() => null);
        return;
      }
      console.error("[AUDIT LOG FAILED]", createErr, { userId, action, entity });
    }
  } catch (error) {
    console.error("[AUDIT LOG FAILED]", error, { userId, action, entity });
  }
};

