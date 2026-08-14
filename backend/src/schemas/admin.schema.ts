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
  inviteTA: z.object({
    body: z.object({
      email: z.string().email("Invalid email format"),
      firstName: z.string().min(1, "First name is required").optional(),
      lastName: z.string().min(1, "Last name is required").optional(),
    }),
  }),
};
