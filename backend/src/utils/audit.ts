import prisma from "./prisma.js";

// Fire-and-forget audit logger. Swallows write errors to prevent blocking the primary transaction.
export const logAudit = async (
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string | number | null,
  details?: Record<string, any>
): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId: typeof entityId === "number" ? entityId : (parseInt(String(entityId), 10) || null),
        details: JSON.stringify(details || {}),
      },
    });
  } catch (error) {
    console.error("[AUDIT LOG FAILED]", error, { userId, action, entity });
  }
};
