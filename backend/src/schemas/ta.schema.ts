import { z } from "zod";

export const taSchema = {
  createJob: z.object({
    body: z.object({
      title: z.string().min(1, "Title is required"),
      description: z.string().min(1, "Description is required"),
      requirements: z.string().min(1, "Requirements are required"),
      location: z.string().optional(),
      status: z.string().optional(),
    }),
  }),
  updateJob: z.object({
    body: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      requirements: z.string().optional(),
      location: z.string().optional(),
      status: z.string().optional(),
    }),
  }),
  updateStatus: z.object({
    body: z.object({
      status: z.string().min(1, "Status is required"),
    }),
  }),
  archiveRestore: z.object({
    body: z.object({
      notes: z.string().optional(),
    }).optional(),
  }),
  scheduleInterview: z.object({
    body: z.object({
      type: z.string().min(1, "Type is required"),
      scheduledAt: z.string().min(1, "Scheduled date is required"),
      notes: z.string().optional(),
    }),
  }),
  updateInterviewStatus: z.object({
    body: z.object({
      result: z.string().min(1, "Result is required"),
      conductedAt: z.string().optional().nullable(),
      notes: z.string().optional(),
    }),
  }),
  uploadPostHireDocument: z.object({
    body: z.object({
      label: z.string().min(1, "Label is required"),
      notes: z.string().optional(),
    }),
  }),
  completeHiring: z.object({
    body: z.object({
      employeeId: z.string().optional(),
      employeeNumber: z.string().optional(),
      department: z.string().optional(),
      position: z.string().optional(),
      startDate: z.string().optional(),
      notes: z.string().optional(),
      reason: z.string().optional(),
    }),
  }),
  endorseCandidate: z.object({
    body: z.object({
      clientId: z.number().int().positive("clientId must be a positive integer"),
      outcome: z.enum(["PENDING", "ENDORSED", "DECLINED"]),
      notes: z.string().optional(),
    }),
  }),
  createComplianceTemplate: z.object({
    body: z.object({
      documentLabel: z.string().min(1, "Document label is required"),
      isRequired: z.boolean().optional(),
    }),
  }),
};
