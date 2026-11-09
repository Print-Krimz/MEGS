import { z } from "zod";
import { FIELD_LIMITS, finiteNumber, optionalSafeText } from "./field-limits.js";

// Fields that come from the client's paper manpower requisition form. All optional.
export const MRF_WORK_SHIFTS = ["DAY", "NIGHT", "MID", "ROTATING", "FLEXIBLE"] as const;
export const MRF_WORK_DAYS = ["MON_FRI", "MON_SAT", "SIX_DAYS_ROTATING", "COMPRESSED_4"] as const;
export const MRF_WORK_HOURS = [8, 10, 12] as const;
export const MRF_REQUEST_REASONS = ["ADDITIONAL", "NEW_POSITION", "REPLACEMENT"] as const;

export const MRF_PAPER_FIELD_KEYS = [
  "department", "workShift", "workDays", "workHoursPerDay", "workTime", "requestReason", "requestReasonNote",
] as const;

/** Spread into the create and update MRF body schemas. */
export const mrfPaperFieldsShape = {
  department: optionalSafeText("Department", FIELD_LIMITS.shortText),
  workShift: z.enum(MRF_WORK_SHIFTS).optional().nullable(),
  workDays: z.enum(MRF_WORK_DAYS).optional().nullable(),
  workHoursPerDay: finiteNumber({ min: 1, max: 24, integer: true })
    .optional()
    .nullable()
    .refine((value) => value == null || (MRF_WORK_HOURS as readonly number[]).includes(value), "Hours per day must be 8, 10, or 12"),
  workTime: optionalSafeText("Work time", FIELD_LIMITS.shortText),
  requestReason: z.enum(MRF_REQUEST_REASONS).optional().nullable(),
  requestReasonNote: optionalSafeText("Reason", FIELD_LIMITS.shortText),
};
