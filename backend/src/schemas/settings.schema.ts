import { z } from "zod";
import { safeTextSchema } from "./field-limits.js";

export const settingsSchema = {
  profile: z.object({
    body: z.object({
      displayName: z.string()
        .refine((value) => !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(value), "Full name contains control characters")
        .pipe(safeTextSchema("Full name", 201)),
    }).strict(),
  }),
};
