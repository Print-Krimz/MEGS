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
  recordInterview: z.object({
    body: z.object({
      type: z.string().min(1, "Type is required"),
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
  endorseCandidate: z.object({
    body: z.object({
      clientId: z.number().int().positive("clientId must be a positive integer").optional(),
      outcome: z.enum(["PENDING", "APPROVED", "DECLINED", "ENDORSED"]).optional().default("PENDING"),
      notes: z.string().optional(),
    }),
  }),
  updateEndorsement: z.object({
    body: z.object({
      outcome: z.enum(["PENDING", "APPROVED", "DECLINED", "ENDORSED"]),
      notes: z.string().optional(),
    }),
  }),
  createComplianceTemplate: z.object({
    body: z.object({
      documentLabel: z.string().min(1, "Document label is required"),
      isRequired: z.boolean().optional(),
    }),
  }),
  signContract: z.object({
    body: z.object({
      contractNotes: z.string().optional(),
      contractDocumentUrl: z.string().optional(),
    }),
  }),
  completeOrientation: z.object({
    body: z.object({
      orientationDate: z.string().optional(),
      orientationNotes: z.string().optional(),
    }),
  }),
  createClient: z.object({
    body: z.object({
      name: z.string().min(1, "Company name is required"),
      tradeName: z.string().optional().nullable(),
      industry: z.string().optional().nullable(),
      contactName: z.string().optional().nullable(),
      contactEmail: z
        .string()
        .email("Invalid email format")
        .refine(
          (val) => {
            if (!val || val.trim() === "") return true;
            return /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(val.trim());
          },
          {
            message: "Official contact email must be a valid @gmail.com address",
          }
        )
        .optional()
        .nullable()
        .or(z.literal("")),
      contactPhone: z
        .string()
        .optional()
        .nullable()
        .refine(
          (val) => {
            if (!val || val.trim() === "") return true;
            const digits = val.replace(/\D/g, "");
            return digits.length >= 7 && digits.length <= 12;
          },
          {
            message: "Contact phone must not exceed 11 digits",
          }
        ),
      address: z.string().optional().nullable(),
      street: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      province: z.string().optional().nullable(),
      postalCode: z.string().optional().nullable(),
    }),
  }),
  updateClient: z.object({
    body: z.object({
      name: z.string().min(1, "Company name is required").optional(),
      tradeName: z.string().optional().nullable(),
      industry: z.string().optional().nullable(),
      contactName: z.string().optional().nullable(),
      contactEmail: z
        .string()
        .email("Invalid email format")
        .refine(
          (val) => {
            if (!val || val.trim() === "") return true;
            return /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(val.trim());
          },
          {
            message: "Official contact email must be a valid @gmail.com address",
          }
        )
        .optional()
        .nullable()
        .or(z.literal("")),
      contactPhone: z
        .string()
        .optional()
        .nullable()
        .refine(
          (val) => {
            if (!val || val.trim() === "") return true;
            const digits = val.replace(/\D/g, "");
            return digits.length >= 7 && digits.length <= 12;
          },
          {
            message: "Contact phone must not exceed 11 digits",
          }
        ),
      address: z.string().optional().nullable(),
      street: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      province: z.string().optional().nullable(),
      postalCode: z.string().optional().nullable(),
      isActive: z.boolean().optional(),
    }),
  }),
};
