import { z } from "zod";
import {
  boundedIdText,
  boundedText,
  FIELD_LIMITS,
  finiteNumber,
  dateOnly,
  formattedDigits,
  formattedMobile,
  formattedPhone,
  optionalPersonNameSchema,
  optionalSafeAddress,
  optionalSafeText,
  optionalSafeProse,
  pageQueryFields,
} from "./field-limits.js";

export const MAX_SUGGESTION_EMPLOYEE_IDS = 25;

/** Comma-separated employee IDs, de-duplicated and capped so one request scores a bounded worker set. */
const employeeIdList = z.string().max(600).transform((raw, ctx) => {
  const parts = raw.split(",").map((part) => part.trim());
  if (parts.some((part) => !/^\d{1,10}$/.test(part) || Number(part) < 1 || Number(part) > FIELD_LIMITS.integerId)) {
    ctx.addIssue({ code: "custom", message: "Enter employee IDs as a comma-separated list of positive whole numbers" });
    return z.NEVER;
  }
  const ids = [...new Set(parts.map(Number))];
  if (ids.length > MAX_SUGGESTION_EMPLOYEE_IDS) {
    ctx.addIssue({ code: "custom", message: `Request at most ${MAX_SUGGESTION_EMPLOYEE_IDS} employees at a time` });
    return z.NEVER;
  }
  return ids;
});

export const employeeSchema = {
  redeploymentQueue: z.object({
    query: z.object({
      ...pageQueryFields,
      search: boundedText(FIELD_LIMITS.search).optional(),
      stage: z.enum(["NEEDS_PLACEMENT", "WAITING_FOR_REPLY", "IN_PROGRESS"]).optional(),
    }).strict(),
  }),
  redeploymentSummary: z.object({ query: z.object({}).strict() }),
  redeploymentSuggestions: z.object({ query: z.object({ employeeIds: employeeIdList.optional() }).strict() }),
  updateRedeployment: z.object({
    params: z.object({ id: boundedIdText }).strict(),
    body: z.object({ ownerId: z.string().uuid().nullable().optional(), followUpAt: dateOnly.nullable().optional(), notes: optionalSafeProse("Notes", FIELD_LIMITS.notes) }).strict(),
  }),
  idParams: z.object({ params: z.object({ id: boundedIdText }).strict() }),
  updateDetails: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      firstName: optionalPersonNameSchema("First Name"),
      middleName: optionalPersonNameSchema("Middle Name"),
      lastName: optionalPersonNameSchema("Last Name"),
      mobileNumber: formattedMobile,
      address: optionalSafeAddress("Residential Address"),
      city: optionalSafeText("City", FIELD_LIMITS.name),
      province: optionalSafeText("Province", FIELD_LIMITS.name),
      barangay: optionalSafeText("Barangay", FIELD_LIMITS.barangay),
      postalCode: z.union([z.string().regex(/^\d{4}$/), z.literal("")]).optional().nullable(),
      dateOfBirth: z.string().max(35).optional().nullable(),
      civilStatus: optionalSafeText("Civil Status", FIELD_LIMITS.shortText),
      gender: optionalSafeText("Gender", FIELD_LIMITS.shortText),
      sss: formattedDigits(0, 10),
      philhealth: formattedDigits(0, 12),
      pagibig: formattedDigits(0, 12),
      tin: formattedDigits(9, 12),
      emergencyContactName: optionalPersonNameSchema("Emergency Contact Name"),
      emergencyContactPhone: formattedPhone,
      emergencyContactRelationship: optionalSafeText("Emergency Contact Relationship", FIELD_LIMITS.name),
      emergencyContactAddress: optionalSafeAddress("Emergency Contact Address"),
      position: optionalSafeText("Position", FIELD_LIMITS.shortText),
      department: optionalSafeText("Department", FIELD_LIMITS.shortText),
      notes: optionalSafeProse("Notes", FIELD_LIMITS.notes),
    }).strict(),
  }),
  listEmployees: z.object({
    query: z
      .object({
        status: z.enum(["ACTIVE", "INACTIVE", "SEPARATED", "AVAILABLE_FOR_REDEPLOYMENT"]).optional(),
        department: boundedText(FIELD_LIMITS.shortText).optional(),
        search: boundedText(FIELD_LIMITS.search).optional(),
        limit: finiteNumber({ min: 1, max: FIELD_LIMITS.pageSize, integer: true }).optional(),
        offset: finiteNumber({ min: 0, max: FIELD_LIMITS.integerId, integer: true }).optional(),
      })
      .optional(),
  }),

  updateStatus: z.object({
    params: z.object({ id: boundedIdText }).strict(),
    body: z.object({
      status: z.enum(["ACTIVE", "INACTIVE", "SEPARATED", "AVAILABLE_FOR_REDEPLOYMENT"]),
      reason: optionalSafeProse("Reason", FIELD_LIMITS.notes),
    }).strict(),
  }),

  createDeployment: z.object({
    params: z.object({ id: boundedIdText }).strict(),
    body: z.object({
      clientId: finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true }),
      mrfId: finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true }).optional(),
      site: optionalSafeText("Site", FIELD_LIMITS.shortText),
      contractStart: z.string().max(35).optional(),
      contractEnd: z.string().max(35).optional(),
      notes: optionalSafeProse("Notes", FIELD_LIMITS.notes),
    }).strict(),
  }),

  endDeployment: z.object({
    params: z.object({ id: boundedIdText }).strict(),
    body: z.object({
      actualEnd: dateOnly,
      reason: z.string().trim().min(1, "Reason is required").max(FIELD_LIMITS.notes),
      disposition: z.enum(["AVAILABLE_FOR_REDEPLOYMENT", "NOT_CONFIRMED", "SEPARATED"]),
    }).strict(),
  }),
};
