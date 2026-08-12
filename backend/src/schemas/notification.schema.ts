import { z } from "zod";

export const notificationSchema = {
  listNotifications: z.object({
    query: z.object({
      limit: z.coerce.number().min(1).max(100).optional(),
      cursor: z.coerce.number().optional(),
    }),
  }),
  markAsRead: z.object({
    params: z.object({
      id: z.coerce.number(),
    }),
  }),
};
