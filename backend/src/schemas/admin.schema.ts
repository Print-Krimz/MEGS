import { z } from "zod";
import { boundedIdText, boundedText, boundedPageSize, dateOnly, finiteNumber, FIELD_LIMITS, requiredText, optionalPersonNameSchema } from "./field-limits.js";

const userId = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, "Invalid user ID");
const backupId = z.string().trim().min(1).max(255).regex(/^[A-Za-z0-9._-]+$/, "Invalid backup ID").refine((value) => !value.includes(".."), "Invalid backup ID");

export const adminSchema = {
  correctInterviewResult: z.object({
    params: z.object({ interviewId: boundedIdText }).strict(),
    body: z.object({
      result: z.enum(["PASS", "PASSED", "FAIL", "FAILED", "NO_SHOW"]),
      reason: z.string().trim().min(10, "A reason of at least 10 characters is required").max(FIELD_LIMITS.notes),
      notes: boundedText(FIELD_LIMITS.notes).optional(),
    }).strict(),
  }),
  listUsers: z.object({
    query: z.object({
      page: finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true }).optional(),
      limit: boundedPageSize.optional(),
      search: boundedText(FIELD_LIMITS.search).optional(),
      role: z.enum(["APPLICANT", "TALENT_ACQUISITION", "ADMINISTRATOR"]).optional(),
      status: z.enum(["active", "inactive", "invited"]).optional(),
    }).strict(),
  }),
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
  idParams: z.object({ params: z.object({ id: boundedIdText }).strict() }),
  assignment: z.object({
    params: z.object({ id: boundedIdText }).strict(),
    body: z.object({ assignedTaId: userId.nullable() }).strict(),
  }),
  reassignRecords: z.object({
    params: z.object({ id: userId }).strict(),
    body: z.object({ toTaId: userId }).strict(),
  }),
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
      firstName: optionalPersonNameSchema("First name"),
      lastName: optionalPersonNameSchema("Last name"),
    }).strict(),
  }),
};
