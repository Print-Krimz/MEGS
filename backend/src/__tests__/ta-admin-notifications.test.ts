import { describe, expect, it, vi, beforeEach } from "vitest";
import prisma from "../utils/prisma.js";
import {
  sendNotification,
  sendRoleNotification,
  notificationEmitter,
} from "../utils/notification.js";
import {
  getNotificationsService,
  getUnreadCountService,
  markAsReadService,
  markAllAsReadService,
} from "../services/core/notification.service.js";

describe("TA & Admin Notification Engine Suite", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  describe("sendNotification & sendRoleNotification", () => {
    it("persists notification with type and link, and emits event to user channel", async () => {
      const testUserId = "user-notif-test-" + Date.now();
      const emitted: any[] = [];

      const listener = (notif: any) => emitted.push(notif);
      notificationEmitter.on(`notification:${testUserId}`, listener);

      const mockCreate = vi.spyOn(prisma.notification, "create").mockResolvedValue({
        id: 101,
        userId: testUserId,
        title: "Interview Scheduled",
        message: "Your initial screening interview has been scheduled.",
        type: "INFO",
        isRead: false,
        link: "/app/applications/123",
        createdAt: new Date(),
      } as any);

      await sendNotification(
        testUserId,
        "Interview Scheduled",
        "Your initial screening interview has been scheduled.",
        "INFO",
        "/app/applications/123"
      );

      // Verify SSE event emission
      expect(emitted.length).toBe(1);
      expect(emitted[0].title).toBe("Interview Scheduled");
      expect(emitted[0].link).toBe("/app/applications/123");
      expect(emitted[0].type).toBe("INFO");

      notificationEmitter.off(`notification:${testUserId}`, listener);
      mockCreate.mockRestore();
    });

    it("broadcasts notifications to specific roles and respects excludeUserId", async () => {
      const mockFindMany = vi.spyOn(prisma.user, "findMany").mockResolvedValue([
        { id: "ta-user-2" },
      ] as any);

      const mockCreate = vi.spyOn(prisma.notification, "create").mockResolvedValue({
        id: 102,
        userId: "ta-user-2",
        title: "New Candidate Application",
        message: "John Doe applied for Delivery Driver.",
        type: "INFO",
        isRead: false,
        link: "/ta/applications/456",
        createdAt: new Date(),
      } as any);

      await sendRoleNotification(
        "TALENT_ACQUISITION",
        "New Candidate Application",
        "John Doe applied for Delivery Driver.",
        "INFO",
        "/ta/applications/456",
        "ta-user-1" // exclude actor
      );

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          role: "TALENT_ACQUISITION",
          isActive: true,
          id: { not: "ta-user-1" },
        },
        select: { id: true },
      });

      mockFindMany.mockRestore();
      mockCreate.mockRestore();
    });
  });

  describe("getNotificationsService & isRead filtering", () => {
    it("filters notifications by isRead boolean when specified", async () => {
      const mockFindMany = vi.spyOn(prisma.notification, "findMany").mockResolvedValue([
        { id: 1, userId: "user-1", title: "Test", isRead: false } as any,
      ]);

      const result = await getNotificationsService("user-1", 10, undefined, false);

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          isRead: false,
        },
        take: 10,
        skip: 0,
        cursor: undefined,
        orderBy: { createdAt: "desc" },
      });
      expect(result.length).toBe(1);

      mockFindMany.mockRestore();
    });
  });

  describe("markAllAsReadService", () => {
    it("updates all unread notifications for a user to isRead: true", async () => {
      const mockUpdateMany = vi.spyOn(prisma.notification, "updateMany").mockResolvedValue({
        count: 4,
      });

      const res = await markAllAsReadService("user-123");

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { userId: "user-123", isRead: false },
        data: { isRead: true },
      });
      expect(res.count).toBe(4);

      mockUpdateMany.mockRestore();
    });
  });
});
