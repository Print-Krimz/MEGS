import { z } from "zod";
import {
  boundedIdText,
  boundedText,
  boundedPageSize,
  finiteNumber,
  dateOnly,
  FIELD_LIMITS,
  formattedMobile,
  formattedPhone,
  isValidDateOnly,
  manilaDateString,
  personNameSchema,
  optionalPersonNameSchema,
  safeTextSchema,
  optionalSafeText,
  safeAddressSchema,
  optionalSafeAddress,
  safeProseSchema,
  optionalSafeProse,
} from "./field-limits.js";

const nonFutureDate = dateOnly.refine((value) => value <= manilaDateString(), "Date cannot be in the future");
const pastDate = dateOnly.refine((value) => value < manilaDateString(), "Date must be earlier than today");
const dateRange = (value: { startDate?: string | null; endDate?: string | null }, ctx: z.RefinementCtx) => {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after start date" });
  }
};
const phoneValidation = formattedPhone;

const heightValidation = z
  .union([z.number().finite(), z.string().max(6)])
  .optional()
  .nullable()
  .refine(
    (val) => {
      if (val === null || val === undefined) return true;
      if (typeof val === "string" && val.trim() === "") return true;
      const num = typeof val === "number" ? val : Number(val);
      return Number.isFinite(num) && num >= 100 && num <= 250 && /^\d+(?:\.\d{1})?$/.test(String(val));
    },
    {
      message: "Height must be between 100 cm and 250 cm",
    }
  );

const weightValidation = z
  .union([z.number().finite(), z.string().max(6)])
  .optional()
  .nullable()
  .refine(
    (val) => {
      if (val === null || val === undefined) return true;
      if (typeof val === "string" && val.trim() === "") return true;
      const num = typeof val === "number" ? val : Number(val);
      return Number.isFinite(num) && num >= 30 && num <= 300 && /^\d+(?:\.\d{1})?$/.test(String(val));
    },
    {
      message: "Weight must be between 30 kg and 300 kg",
    }
  );

const sssValidation = z
  .string()
  .optional()
  .nullable()
  .refine(
    (val) => {
      if (!val || val.trim() === "") return true;
      const digits = val.replace(/\D/g, "");
      return /^[\d -]+$/.test(val) && digits.length > 0 && digits.length <= 10;
    },
    {
      message: "SSS number must not exceed 10 digits",
    }
  );

const philhealthValidation = z
  .string()
  .optional()
  .nullable()
  .refine(
    (val) => {
      if (!val || val.trim() === "") return true;
      const digits = val.replace(/\D/g, "");
      return /^[\d -]+$/.test(val) && digits.length > 0 && digits.length <= 12;
    },
    {
      message: "PhilHealth number must not exceed 12 digits",
    }
  );

const pagibigValidation = z
  .string()
  .optional()
  .nullable()
  .refine(
    (val) => {
      if (!val || val.trim() === "") return true;
      const digits = val.replace(/\D/g, "");
      return /^[\d -]+$/.test(val) && digits.length > 0 && digits.length <= 12;
    },
    {
      message: "Pag-IBIG number must not exceed 12 digits",
    }
  );

const tinValidation = z
  .string()
  .optional()
  .nullable()
  .refine(
    (val) => {
      if (!val || val.trim() === "") return true;
      return /^[\d -]+$/.test(val) && val.replace(/\D/g, "").length >= 9 && val.replace(/\D/g, "").length <= 12;
    },
    {
      message: "TIN must be between 9 and 12 digits",
    }
  );

export const applicantSchema = {
  idParams: z.object({ params: z.object({ id: boundedIdText }).strict() }),
  emptyUploadBody: z.object({ body: z.object({}).strict().optional() }),
  upsertProfile: z.object({
    body: z.object({
      firstName: optionalPersonNameSchema("First Name"),
      middleName: optionalPersonNameSchema("Middle Name"),
      lastName: optionalPersonNameSchema("Last Name"),
      mobileNumber: formattedMobile,
      gender: optionalSafeText("Gender", FIELD_LIMITS.shortText),
      province: optionalSafeText("Province", FIELD_LIMITS.name),
      city: optionalSafeText("City", FIELD_LIMITS.name),
      barangay: optionalSafeText("Barangay", FIELD_LIMITS.barangay),
      postalCode: z.union([z.string().regex(/^\d{4}$/, "Postal code must be exactly 4 digits"), z.literal("")]).optional().nullable(),
      dateOfBirth: z.union([pastDate, z.literal("")]).optional().nullable(),
      birthPlace: optionalSafeText("Birth Place", FIELD_LIMITS.shortText),
      nationality: optionalSafeText("Nationality", FIELD_LIMITS.name),
      civilStatus: optionalSafeText("Civil Status", FIELD_LIMITS.shortText),
      height: heightValidation,
      weight: weightValidation,
      religion: optionalSafeText("Religion", FIELD_LIMITS.shortText),
      address: optionalSafeAddress("Residential Address"),
      preferredWorkLocations: optionalSafeText("Preferred Work Locations", FIELD_LIMITS.notes),
      pagibig: pagibigValidation,
      philhealth: philhealthValidation,
      sss: sssValidation,
      tin: tinValidation,
      emergencyContactName: optionalPersonNameSchema("Emergency Contact Name"),
      emergencyContactRelationship: optionalSafeText("Emergency Contact Relationship", FIELD_LIMITS.name),
      emergencyContactPhone: phoneValidation,
      emergencyContactAddress: optionalSafeAddress("Emergency Contact Address"),
      professionalSummary: optionalSafeProse("Professional Summary", FIELD_LIMITS.summary),
      additionalNotes: optionalSafeProse("Additional Notes", FIELD_LIMITS.notes),
    }),
  }),
  addWorkExperience: z.object({
    body: z.object({
      company: safeTextSchema("Company", FIELD_LIMITS.shortText),
      title: safeTextSchema("Title", FIELD_LIMITS.shortText),
      location: optionalSafeText("Location", FIELD_LIMITS.shortText),
      startDate: nonFutureDate,
      endDate: nonFutureDate.optional().nullable(),
      isCurrent: z.boolean().optional(),
      description: optionalSafeProse("Description", FIELD_LIMITS.notes),
    }).superRefine((value, ctx) => {
      dateRange(value, ctx);
      if (value.isCurrent && value.endDate) {
        ctx.addIssue({ code: "custom", path: ["endDate"], message: "Current work must not have an end date" });
      }
    }),
  }),
  addEducation: z.object({
    body: z.object({
      school: safeTextSchema("School", FIELD_LIMITS.shortText),
      institution: optionalSafeText("Institution", FIELD_LIMITS.shortText),
      degree: safeTextSchema("Degree", FIELD_LIMITS.shortText),
      field: safeTextSchema("Field of study", FIELD_LIMITS.shortText),
      startDate: nonFutureDate,
      endDate: dateOnly.optional().nullable(),
      notes: optionalSafeProse("Notes", FIELD_LIMITS.notes),
    }).superRefine(dateRange),
  }),
  updateSkills: z.object({
    body: z.object({
      skills: z.array(z.string().trim().min(1).max(FIELD_LIMITS.label), { message: "Skills array is required" }).max(FIELD_LIMITS.skills)
        .refine((skills) => new Set(skills.map((skill) => skill.toLowerCase())).size === skills.length, "Skills must not contain duplicates"),
    }),
  }),
  addTraining: z.object({
    body: z.object({
      title: safeTextSchema("Title", FIELD_LIMITS.shortText),
      provider: safeTextSchema("Provider", FIELD_LIMITS.shortText),
      completionDate: nonFutureDate.optional().nullable(),
      certificateNo: optionalSafeText("Certificate Number", FIELD_LIMITS.label),
      notes: optionalSafeProse("Notes", FIELD_LIMITS.notes),
    }),
  }),
  addReference: z.object({
    body: z.object({
      name: personNameSchema("Reference Name"),
      relationship: safeTextSchema("Relationship", FIELD_LIMITS.name),
      phone: phoneValidation,
      email: z.string().email("Invalid email format").max(FIELD_LIMITS.email).optional().or(z.literal("")),
      notes: optionalSafeProse("Notes", FIELD_LIMITS.notes),
    }),
  }),
  addAsset: z.object({
    body: z.object({
      label: safeTextSchema("Label", FIELD_LIMITS.label),
      notes: optionalSafeProse("Notes", FIELD_LIMITS.notes),
    }),
  }),
  applyExtractedProfile: z.object({
    body: z.object({
      personalDetails: z.object({
        firstName: optionalPersonNameSchema("First Name"),
        middleName: optionalPersonNameSchema("Middle Name"),
        lastName: optionalPersonNameSchema("Last Name"),
        mobileNumber: formattedMobile,
        gender: optionalSafeText("Gender", FIELD_LIMITS.shortText),
        province: optionalSafeText("Province", FIELD_LIMITS.name),
        city: optionalSafeText("City", FIELD_LIMITS.name),
        dateOfBirth: z.union([pastDate, z.literal("")]).optional().nullable(),
        birthPlace: optionalSafeText("Birth Place", FIELD_LIMITS.shortText),
        nationality: optionalSafeText("Nationality", FIELD_LIMITS.name),
        civilStatus: optionalSafeText("Civil Status", FIELD_LIMITS.shortText),
        barangay: optionalSafeText("Barangay", FIELD_LIMITS.barangay),
        postalCode: z.string().regex(/^\d{4}$/).optional().nullable(),
        height: heightValidation,
        weight: weightValidation,
        address: optionalSafeAddress("Residential Address"),
        preferredWorkLocations: optionalSafeText("Preferred Work Locations", FIELD_LIMITS.notes),
        professionalSummary: optionalSafeProse("Professional Summary", FIELD_LIMITS.summary),
      }).optional(),
      overwriteExistingPersonal: z.boolean().optional(),
      workExperiences: z.array(
        z.object({
          company: safeTextSchema("Company", FIELD_LIMITS.shortText),
          roleTitle: safeTextSchema("Job Title", FIELD_LIMITS.shortText),
          location: optionalSafeText("Location", FIELD_LIMITS.shortText),
          startDate: nonFutureDate,
          endDate: nonFutureDate.optional().nullable(),
          isCurrent: z.boolean().optional(),
          summary: optionalSafeProse("Summary", FIELD_LIMITS.notes),
        }).superRefine((value, ctx) => {
          dateRange(value, ctx);
          if (value.isCurrent && value.endDate) {
            ctx.addIssue({ code: "custom", path: ["endDate"], message: "Current work must not have an end date" });
          }
        })
      ).max(FIELD_LIMITS.records).optional(),
      educations: z.array(
        z.object({
          school: safeTextSchema("School", FIELD_LIMITS.shortText),
          degree: optionalSafeText("Degree", FIELD_LIMITS.shortText),
          fieldOfStudy: optionalSafeText("Field of Study", FIELD_LIMITS.shortText),
          startDate: nonFutureDate.optional().nullable(),
          endDate: dateOnly.optional().nullable(),
          notes: optionalSafeProse("Notes", FIELD_LIMITS.notes),
        }).superRefine(dateRange)
      ).max(FIELD_LIMITS.records).optional(),
      skills: z.array(z.string().trim().min(1).max(FIELD_LIMITS.label)).max(FIELD_LIMITS.skills).optional(),
      trainings: z.array(
        z.object({
          title: safeTextSchema("Title", FIELD_LIMITS.shortText),
          provider: optionalSafeText("Provider", FIELD_LIMITS.shortText),
          completionDate: nonFutureDate.optional().nullable(),
          certificateNo: optionalSafeText("Certificate Number", FIELD_LIMITS.label),
          notes: optionalSafeProse("Notes", FIELD_LIMITS.notes),
        })
      ).max(FIELD_LIMITS.records).optional(),
      characterReferences: z.array(
        z.object({
          name: personNameSchema("Reference Name"),
          relationship: optionalSafeText("Relationship", FIELD_LIMITS.name),
          company: optionalSafeText("Company", FIELD_LIMITS.shortText),
          phone: phoneValidation,
          email: z.string().email().max(FIELD_LIMITS.email).optional().nullable(),
          notes: optionalSafeProse("Notes", FIELD_LIMITS.notes),
        })
      ).max(FIELD_LIMITS.records).optional(),
    }),
  }),
  listSavedJobsQuery: z.object({
    search: boundedText(FIELD_LIMITS.search).optional(),
    location: boundedText(FIELD_LIMITS.shortText).optional(),
    department: boundedText(FIELD_LIMITS.shortText).optional(),
    page: finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true }).optional(),
    limit: boundedPageSize.optional(),
  }),
};

export const listSavedJobsQuerySchema = applicantSchema.listSavedJobsQuery;
