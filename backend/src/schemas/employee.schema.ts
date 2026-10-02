import { z } from "zod";
import { boundedIdText, boundedText, FIELD_LIMITS, finiteNumber, dateOnly, formattedDigits, formattedMobile, formattedPhone } from "./field-limits.js";

export const employeeSchema = {
  idParams: z.object({ params: z.object({ id: boundedIdText }).strict() }),
  updateDetails: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      firstName: boundedText(FIELD_LIMITS.name).optional(),
      middleName: boundedText(FIELD_LIMITS.name).optional().nullable(),
      lastName: boundedText(FIELD_LIMITS.name).optional(),
      mobileNumber: formattedMobile,
      address: boundedText(FIELD_LIMITS.address).optional().nullable(),
      city: boundedText(FIELD_LIMITS.name).optional().nullable(),
      province: boundedText(FIELD_LIMITS.name).optional().nullable(),
      barangay: boundedText(FIELD_LIMITS.barangay).optional().nullable(),
      postalCode: z.union([z.string().regex(/^\d{4}$/), z.literal("")]).optional().nullable(),
      dateOfBirth: z.string().max(35).optional().nullable(),
      civilStatus: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      gender: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      sss: formattedDigits(0, 10),
      philhealth: formattedDigits(0, 12),
      pagibig: formattedDigits(0, 12),
      tin: formattedDigits(9, 12),
      emergencyContactName: boundedText(FIELD_LIMITS.name).optional().nullable(),
      emergencyContactPhone: formattedPhone,
      emergencyContactRelationship: boundedText(FIELD_LIMITS.name).optional().nullable(),
      emergencyContactAddress: boundedText(FIELD_LIMITS.address).optional().nullable(),
      position: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      department: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      notes: boundedText(FIELD_LIMITS.notes).optional().nullable(),
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
      reason: boundedText(FIELD_LIMITS.notes).optional(),
    }).strict(),
  }),

  createDeployment: z.object({
    params: z.object({ id: boundedIdText }).strict(),
    body: z.object({
      clientId: finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true }),
      mrfId: finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true }).optional(),
      site: boundedText(FIELD_LIMITS.shortText).optional(),
      contractStart: z.string().max(35).optional(),
      contractEnd: z.string().max(35).optional(),
      notes: boundedText(FIELD_LIMITS.notes).optional(),
    }).strict(),
  }),

  endDeployment: z.object({
    params: z.object({ id: boundedIdText }).strict(),
    body: z.object({
      reason: boundedText(FIELD_LIMITS.notes).optional(),
      makeAvailableForRedeployment: z.boolean().optional().default(true),
    }).strict(),
  }),
};
