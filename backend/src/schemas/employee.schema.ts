import { z } from "zod";

export const employeeSchema = {
  listEmployees: z.object({
    query: z
      .object({
        status: z.enum(["ACTIVE", "INACTIVE", "SEPARATED", "AVAILABLE_FOR_REDEPLOYMENT"]).optional(),
        department: z.string().optional(),
        search: z.string().optional(),
        limit: z.coerce.number().min(1).max(100).optional(),
        offset: z.coerce.number().min(0).optional(),
      })
      .optional(),
  }),

  updateStatus: z.object({
    body: z.object({
      status: z.enum(["ACTIVE", "INACTIVE", "SEPARATED", "AVAILABLE_FOR_REDEPLOYMENT"]),
      reason: z.string().optional(),
    }),
  }),

  createDeployment: z.object({
    body: z.object({
      clientId: z.number().int().positive("Client ID must be a positive integer"),
      mrfId: z.number().int().positive().optional(),
      site: z.string().optional(),
      contractStart: z.string().or(z.date()).optional(),
      contractEnd: z.string().or(z.date()).optional(),
      notes: z.string().optional(),
    }),
  }),

  endDeployment: z.object({
    body: z.object({
      reason: z.string().optional(),
      makeAvailableForRedeployment: z.boolean().optional().default(true),
    }),
  }),
};
