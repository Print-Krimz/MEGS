import { z } from "zod";

export const notificationSchema = {
  listNotifications: z.object({
    query: z.object({
      limit: z.coerce.number().min(1).max(100).optional(),
      cursor: z.coerce.number().optional(),
      page: z.coerce.number().optional(),
      isRead: z
        .preprocess((val) => {
          if (val === "true" || val === true) return true;
          if (val === "false" || val === false) return false;
          return val;
        }, z.boolean())
        .optional(),
    }),
  }),
  markAsRead: z.object({
    params: z.object({
      id: z.coerce.number(),
    }),
  }),
};
