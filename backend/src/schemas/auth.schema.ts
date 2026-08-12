import { z } from "zod";

export const authSchema = {
  register: z.object({
    body: z.object({
      email: z.string().email("Invalid email format"),
      password: z.string().min(6, "Password must be at least 6 characters long"),
    }),
  }),
  login: z.object({
    body: z.object({
      email: z.string().email("Invalid email format"),
      password: z.string().min(1, "Password is required"),
    }),
  }),
};
