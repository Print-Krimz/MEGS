import { z } from "zod";
import { boundedIdText, boundedText, boundedPageSize, dateOnly, finiteNumber, FIELD_LIMITS, requiredText } from "./field-limits.js";

const userId = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, "Invalid user ID");
const backupId = z.string().trim().min(1).max(255).regex(/^[A-Za-z0-9._-]+$/, "Invalid backup ID").refine((value) => !value.includes(".."), "Invalid backup ID");

export const adminSchema = {
  listUsers: z.object({ query: z.object({}).strict() }),
  userParams: z.object({ params: z.object({ id: userId }).strict() }),
  backupList: z.object({ query: z.object({ limit: finiteNumber({ min: 1, max: FIELD_LIMITS.pageSize, integer: true }).optional() }).strict() }),
  backupIdParams: z.object({ params: z.object({ id: backupId }).strict() }),
  triggerBackup: z.object({ body: z.object({ customName: boundedText(FIELD_LIMITS.shortText).optional().nullable() }).strict().optional() }),
  renameBackup: z.object({
    params: z.object({ id: backupId }).strict(),
    body: z.object({ name: requiredText("Backup name", FIELD_LIMITS.shortText) }).strict(),
  }),
  restoreUploadedBackup: z.object({ body: z.object({}).strict().optional() }),
  mrfIdParams: z.object({ params: z.object({ id: boundedIdText }).strict() }),
  auditLogs: z.object({
    query: z.object({
      action: boundedText(FIELD_LIMITS.shortText).optional(),
      userId: boundedText(128).optional(),
      entity: boundedText(FIELD_LIMITS.shortText).optional(),
      category: boundedText(FIELD_LIMITS.shortText).optional(),
      search: boundedText(FIELD_LIMITS.search).optional(),
      startDate: dateOnly.optional(),
      endDate: dateOnly.optional(),
      limit: boundedPageSize.optional(),
    }).strict().superRefine((query, ctx) => {
      if (query.startDate && query.endDate && query.startDate > query.endDate) {
        ctx.addIssue({ code: "custom", path: ["endDate"], message: "Start date must be on or before end date" });
      }
    }),
  }),
  auditExport: z.object({
    query: z.object({
      action: boundedText(FIELD_LIMITS.shortText).optional(),
      userId: boundedText(128).optional(),
      entity: boundedText(FIELD_LIMITS.shortText).optional(),
      category: boundedText(FIELD_LIMITS.shortText).optional(),
      search: boundedText(FIELD_LIMITS.search).optional(),
      startDate: dateOnly.optional(),
      endDate: dateOnly.optional(),
      format: z.enum(["pdf", "xlsx", "csv"]).optional(),
    }).strict().superRefine((query, ctx) => {
      if (query.startDate && query.endDate && query.startDate > query.endDate) {
        ctx.addIssue({ code: "custom", path: ["endDate"], message: "Start date must be on or before end date" });
      }
    }),
  }),
  updateUserRole: z.object({
    params: z.object({ id: userId }).strict(),
    body: z.object({
      role: z.enum(["APPLICANT", "TALENT_ACQUISITION", "ADMINISTRATOR"]),
    }).strict(),
  }),
  updateUserStatus: z.object({
    params: z.object({ id: userId }).strict(),
    body: z.object({
      isActive: z.boolean(),
    }).strict(),
  }),
  inviteTA: z.object({
    body: z.object({
      email: z.string().email("Invalid email format").max(FIELD_LIMITS.email),
      firstName: z.string().trim().min(1, "First name is required").max(FIELD_LIMITS.name).optional(),
      lastName: z.string().trim().min(1, "Last name is required").max(FIELD_LIMITS.name).optional(),
    }).strict(),
  }),
};
