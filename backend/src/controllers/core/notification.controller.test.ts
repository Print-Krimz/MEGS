import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../utils/prisma.js", () => ({ default: {} }));
vi.mock("../../services/core/notification.service.js", () => ({
  getNotificationsService: vi.fn(),
  getUnreadCountService: vi.fn(),
  markAsReadService: vi.fn(),
}));

import {
  streamNotifications,
  listNotifications,
  getUnreadCount,
  markAsRead,
} from "./notification.controller.js";
import { notificationEmitter } from "../../utils/notification.js";
import {
  getNotificationsService,
  getUnreadCountService,
  markAsReadService,
} from "../../services/core/notification.service.js";

const mockResponse = () => {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const setHeader = vi.fn();
  const flushHeaders = vi.fn();
  const write = vi.fn();
  return { status, json, setHeader, flushHeaders, write };
};

describe("Notification Controller Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/notifications/stream (SSE)", () => {
    it("configures SSE headers, calls flushHeaders, and sends initial CONNECTED payload", () => {
      const res = mockResponse();
      const reqListeners: Record<string, Function> = {};
      const req: any = {
        user: { id: "user-sse-1" },
        on: vi.fn((event: string, cb: Function) => {
          reqListeners[event] = cb;
        }),
      };

      streamNotifications(req, res as any);

      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
      expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");
      expect(res.setHeader).toHaveBeenCalledWith("Connection", "keep-alive");
      expect(res.setHeader).toHaveBeenCalledWith("X-Accel-Buffering", "no");
      expect(res.flushHeaders).toHaveBeenCalled();
      expect(res.write).toHaveBeenCalledWith('data: {"type": "CONNECTED"}\n\n');

      // Test real-time emission
      const sampleNotification = {
        id: 99,
        userId: "user-sse-1",
        title: "Test Alert",
        message: "You have a new interview",
        type: "INFO",
      };

      notificationEmitter.emit("notification:user-sse-1", sampleNotification);

      expect(res.write).toHaveBeenCalledWith(`data: ${JSON.stringify(sampleNotification)}\n\n`);

      // Clean up on close
      reqListeners["close"]?.();
      expect(notificationEmitter.listenerCount("notification:user-sse-1")).toBe(0);
    });
  });

  describe("GET /api/notifications", () => {
    it("returns list of notifications for user", async () => {
      const res = mockResponse();
      const mockList = [{ id: 1, title: "Offer Extended", isRead: false }];
      vi.mocked(getNotificationsService).mockResolvedValue(mockList as any);

      const req: any = {
        user: { id: "user-123" },
        query: { limit: "10" },
      };

      await listNotifications(req, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockList,
        })
      );
    });
  });

  describe("GET /api/notifications/unread-count", () => {
    it("returns unread count for user", async () => {
      const res = mockResponse();
      vi.mocked(getUnreadCountService).mockResolvedValue(5);

      const req: any = {
        user: { id: "user-123" },
      };

      await getUnreadCount(req, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { count: 5 },
        })
      );
    });
  });

  describe("PATCH /api/notifications/:id/read", () => {
    it("marks notification as read", async () => {
      const res = mockResponse();
      const mockUpdated = { id: 1, userId: "user-123", isRead: true };
      vi.mocked(markAsReadService).mockResolvedValue(mockUpdated as any);

      const req: any = {
        user: { id: "user-123" },
        params: { id: "1" },
      };

      await markAsRead(req, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockUpdated,
        })
      );
    });
  });
});
