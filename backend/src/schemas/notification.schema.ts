import { z } from "zod";
import { FIELD_LIMITS, finiteNumber } from "./field-limits.js";

export const notificationSchema = {
  listNotifications: z.object({
    query: z.object({
      limit: finiteNumber({ min: 1, max: FIELD_LIMITS.pageSize, integer: true }).optional(),
      cursor: finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true }).optional(),
      page: finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true }).optional(),
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
      id: finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true }),
    }),
  }),
};
