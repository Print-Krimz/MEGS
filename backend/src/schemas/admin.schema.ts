import { z } from "zod";

export const adminSchema = {
  updateUserRole: z.object({
    body: z.object({
      role: z.string().min(1, "Role is required"),
    }),
  }),
  updateUserStatus: z.object({
    body: z.object({
      isActive: z.boolean(),
    }),
  }),
  createPolicy: z.object({
    body: z.object({
      key: z.string().min(1, "Key is required"),
      value: z.string().min(1, "Value is required"),
      description: z.string().optional(),
    }),
  }),
  updatePolicy: z.object({
    body: z.object({
      value: z.string().min(1, "Value is required"),
      description: z.string().optional(),
    }),
  }),
};
