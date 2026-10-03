import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import { notificationEmitter } from '../../utils/notification.js';
import prisma from '../../utils/prisma.js';
import { isSessionRevoked } from '../../security/session-revocation.js';
import { isActiveAccount, isMfaEnforced, STAFF_ROLES } from '../../security/auth-policy.js';
import {
  getNotificationsService,
  getUnreadCountService,
  markAsReadService,
  markAllAsReadService,
} from '../../services/core/notification.service.js';

// GET /api/notifications/stream - Real-time SSE channel for incoming user notifications
export const streamNotifications = (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const expiresAt = (req.user?.tokenExpiresAt || 0) * 1000;
  const token = req.headers.authorization?.match(/^Bearer\s+([^\s]+)$/i)?.[1] || "";
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    sendError(res, "Invalid or expired token", 401);
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  res.flushHeaders();

  res.write("data: {\"type\": \"CONNECTED\"}\n\n");

  const eventName = `notification:${userId}`;
  const logoutEvent = `session:closed:${userId}`;
  let closed = false;
  let pendingCheck: Promise<boolean> | undefined;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(keepAlive);
    clearTimeout(expiryTimer);
    notificationEmitter.removeListener(eventName, listener);
    notificationEmitter.removeListener(logoutEvent, close);
    if (!res.writableEnded) res.end();
  };
  const checkAccount = (): Promise<boolean> => {
    if (closed || Date.now() >= expiresAt) { close(); return Promise.resolve(false); }
    if (!pendingCheck) {
      pendingCheck = isSessionRevoked(token).then((revoked) => {
        if (revoked) { close(); return null; }
        return prisma.user.findUnique({ where: { id: userId }, select: {
        role: true, isActive: true, accountStatus: true, mustChangePassword: true,
        } });
      }).then((account) => {
        const allowed = !!account && isActiveAccount(account.isActive, account.accountStatus) &&
          !account.mustChangePassword && account.role === req.user!.role &&
          (!isMfaEnforced() || !STAFF_ROLES.has(account.role) || req.user!.aal === "aal2");
        if (!allowed) close();
        return allowed && !closed && Date.now() < expiresAt;
      }).catch(() => { close(); return false; }).finally(() => { pendingCheck = undefined; });
    }
    return pendingCheck;
  };
  const listener = async (notification: unknown) => {
    if (await checkAccount()) res.write(`data: ${JSON.stringify(notification)}\n\n`);
  };

  notificationEmitter.on(eventName, listener);
  notificationEmitter.on(logoutEvent, close);

  // 30s heartbeat to prevent proxy timeout
  const keepAlive = setInterval(async () => {
    if (await checkAccount()) res.write(": keep-alive\n\n");
  }, 30000);
  // The expiry comes from verified claims; never decode an unverified token here.
  const expiryTimer = setTimeout(close, Math.min(expiresAt - Date.now(), 2_147_483_647));

  res.on("close", close);
  res.on("error", close);
};

// GET /api/notifications - Paginated notification history
export const listNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { limit = 20, cursor, isRead, page } = req.query;

    const take = parseInt(String(limit), 10) || 20;
    const pageNum = page ? parseInt(String(page), 10) : undefined;
    const cursorId = cursor ? parseInt(String(cursor), 10) : undefined;
    const filterIsRead = String(isRead) === "true" ? true : String(isRead) === "false" ? false : undefined;

    const result = await getNotificationsService(userId, take, cursorId, filterIsRead, pageNum);

    sendSuccess(res, "Notifications retrieved", result);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

// GET /api/notifications/unread-count - Unread badge count
export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const count = await getUnreadCountService(userId);
    sendSuccess(res, "Unread count retrieved", { count });
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

// PATCH /api/notifications/:id/read - Mark notification as read
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const notifId = parseInt(req.params.id as string);

    const updated = await markAsReadService(userId, notifId);
    sendSuccess(res, "Notification marked as read", updated);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 :
                       error.message.includes("Unauthorized") ? 403 : 500;
    sendError(res, error.message, statusCode);
  }
};

// PATCH /api/notifications/read-all - Mark all unread notifications as read
export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const result = await markAllAsReadService(userId);
    sendSuccess(res, "All notifications marked as read", result);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};
