import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import { notificationEmitter } from '../../utils/notification.js';
import {
  getNotificationsService,
  getUnreadCountService,
  markAsReadService
} from '../../services/core/notification.service.js';

// GET /api/notifications/stream - Real-time SSE channel for incoming user notifications
export const streamNotifications = (req: Request, res: Response): void => {
  const userId = req.user!.id;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.write("data: {\"type\": \"CONNECTED\"}\n\n");

  const eventName = `notification:${userId}`;
  const listener = (notification: any) => {
    res.write(`data: ${JSON.stringify(notification)}\n\n`);
  };

  notificationEmitter.on(eventName, listener);

  // 30s heartbeat to prevent proxy timeout
  const keepAlive = setInterval(() => {
    res.write(": keep-alive\n\n");
  }, 30000);

  req.on("close", () => {
    clearInterval(keepAlive);
    notificationEmitter.removeListener(eventName, listener);
  });
};

// GET /api/notifications - Paginated notification history
export const listNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { limit = 20, cursor } = req.query;

    const take = parseInt(String(limit), 10) || 20;
    const cursorId = cursor ? parseInt(String(cursor), 10) : undefined;

    const notifications = await getNotificationsService(userId, take, cursorId);

    sendSuccess(res, "Notifications retrieved", notifications);
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
