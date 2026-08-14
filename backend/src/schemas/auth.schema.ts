import { z } from "zod";

export const authSchema = {
  register: z.object({
    body: z.object({
      email: z.string().email("Invalid email format"),
      password: z.string().min(8, "Password must be at least 8 characters long"),
    }),
  }),
  login: z.object({
    body: z.object({
      email: z.string().email("Invalid email format"),
      password: z.string().min(1, "Password is required"),
    }),
  }),
  forgotPassword: z.object({
    body: z.object({
      email: z.string().email("Invalid email format"),
    }),
  }),
  resetPassword: z.object({
    body: z.object({
      token: z.string().min(1, "Reset token is required"),
      password: z.string().min(8, "Password must be at least 8 characters long"),
    }),
  }),
  changePassword: z.object({
    body: z.object({
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: z.string().min(8, "New password must be at least 8 characters long"),
    }),
  }),
  setupAccount: z.object({
    body: z.object({
      token: z.string().min(1, "Setup token is required"),
      password: z.string().min(8, "Password must be at least 8 characters long"),
    }),
  }),
};
