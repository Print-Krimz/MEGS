import { z } from "zod";
import { boundedIdText, boundedText, dateOnly, FIELD_LIMITS, formattedMobile, formattedPhone, isValidDateOnly, manilaDateString } from "./field-limits.js";

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
      firstName: z.string().trim().min(1, "First name is required").max(FIELD_LIMITS.name).optional(),
      middleName: boundedText(FIELD_LIMITS.name).optional().nullable(),
      lastName: z.string().trim().min(1, "Last name is required").max(FIELD_LIMITS.name).optional(),
      mobileNumber: formattedMobile,
      gender: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      province: boundedText(FIELD_LIMITS.name).optional().nullable(),
      city: boundedText(FIELD_LIMITS.name).optional().nullable(),
      barangay: boundedText(FIELD_LIMITS.barangay).optional().nullable(),
      postalCode: z.union([z.string().regex(/^\d{4}$/, "Postal code must be exactly 4 digits"), z.literal("")]).optional().nullable(),
      dateOfBirth: z.union([pastDate, z.literal("")]).optional().nullable(),
      birthPlace: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      nationality: boundedText(FIELD_LIMITS.name).optional().nullable(),
      civilStatus: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      height: heightValidation,
      weight: weightValidation,
      religion: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      address: boundedText(FIELD_LIMITS.address).optional().nullable(),
      preferredWorkLocations: boundedText(FIELD_LIMITS.notes).optional().nullable(),
      pagibig: pagibigValidation,
      philhealth: philhealthValidation,
      sss: sssValidation,
      tin: tinValidation,
      emergencyContactName: boundedText(FIELD_LIMITS.name).optional().nullable(),
      emergencyContactRelationship: boundedText(FIELD_LIMITS.name).optional().nullable(),
      emergencyContactPhone: phoneValidation,
      emergencyContactAddress: boundedText(FIELD_LIMITS.address).optional().nullable(),
      professionalSummary: boundedText(FIELD_LIMITS.summary).optional().nullable(),
      additionalNotes: boundedText(FIELD_LIMITS.notes).optional().nullable(),
    }),
  }),
  addWorkExperience: z.object({
    body: z.object({
      company: z.string().trim().min(1, "Company is required").max(FIELD_LIMITS.shortText),
      title: z.string().trim().min(1, "Title is required").max(FIELD_LIMITS.shortText),
      location: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      startDate: nonFutureDate,
      endDate: nonFutureDate.optional().nullable(),
      isCurrent: z.boolean().optional(),
      description: boundedText(FIELD_LIMITS.notes).optional().nullable(),
    }).superRefine((value, ctx) => {
      dateRange(value, ctx);
      if (value.isCurrent && value.endDate) {
        ctx.addIssue({ code: "custom", path: ["endDate"], message: "Current work must not have an end date" });
      }
    }),
  }),
  addEducation: z.object({
    body: z.object({
      school: z.string().trim().min(1, "School is required").max(FIELD_LIMITS.shortText),
      institution: boundedText(FIELD_LIMITS.shortText).optional(),
      degree: z.string().trim().min(1, "Degree is required").max(FIELD_LIMITS.shortText),
      field: z.string().trim().min(1, "Field of study is required").max(FIELD_LIMITS.shortText),
      startDate: nonFutureDate,
      endDate: dateOnly.optional().nullable(),
      notes: boundedText(FIELD_LIMITS.notes).optional().nullable(),
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
      title: z.string().trim().min(1, "Title is required").max(FIELD_LIMITS.shortText),
      provider: z.string().trim().min(1, "Provider is required").max(FIELD_LIMITS.shortText),
      completionDate: nonFutureDate.optional().nullable(),
      certificateNo: boundedText(FIELD_LIMITS.label).optional().nullable(),
      notes: boundedText(FIELD_LIMITS.notes).optional().nullable(),
    }),
  }),
  addReference: z.object({
    body: z.object({
      name: z.string().trim().min(1, "Name is required").max(FIELD_LIMITS.name),
      relationship: z.string().trim().min(1, "Relationship is required").max(FIELD_LIMITS.name),
      phone: phoneValidation,
      email: z.string().email("Invalid email format").max(FIELD_LIMITS.email).optional().or(z.literal("")),
      notes: boundedText(FIELD_LIMITS.notes).optional().nullable(),
    }),
  }),
  addAsset: z.object({
    body: z.object({
      label: z.string().trim().min(1, "Label is required").max(FIELD_LIMITS.label),
      notes: boundedText(FIELD_LIMITS.notes).optional().nullable(),
    }),
  }),
  applyExtractedProfile: z.object({
    body: z.object({
      personalDetails: z.object({
        firstName: boundedText(FIELD_LIMITS.name).optional().nullable(),
        middleName: boundedText(FIELD_LIMITS.name).optional().nullable(),
        lastName: boundedText(FIELD_LIMITS.name).optional().nullable(),
        mobileNumber: formattedMobile,
        gender: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
        province: boundedText(FIELD_LIMITS.name).optional().nullable(),
        city: boundedText(FIELD_LIMITS.name).optional().nullable(),
        dateOfBirth: z.union([pastDate, z.literal("")]).optional().nullable(),
        birthPlace: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
        nationality: boundedText(FIELD_LIMITS.name).optional().nullable(),
        civilStatus: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
        barangay: boundedText(FIELD_LIMITS.barangay).optional().nullable(),
        postalCode: z.string().regex(/^\d{4}$/).optional().nullable(),
        height: heightValidation,
        weight: weightValidation,
        address: boundedText(FIELD_LIMITS.address).optional().nullable(),
        preferredWorkLocations: boundedText(FIELD_LIMITS.notes).optional().nullable(),
        professionalSummary: boundedText(FIELD_LIMITS.summary).optional().nullable(),
      }).optional(),
      overwriteExistingPersonal: z.boolean().optional(),
      workExperiences: z.array(
        z.object({
          company: z.string().trim().min(1).max(FIELD_LIMITS.shortText),
          roleTitle: z.string().trim().min(1).max(FIELD_LIMITS.shortText),
          location: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
          startDate: nonFutureDate,
          endDate: nonFutureDate.optional().nullable(),
          isCurrent: z.boolean().optional(),
          summary: boundedText(FIELD_LIMITS.notes).optional().nullable(),
        }).superRefine((value, ctx) => {
          dateRange(value, ctx);
          if (value.isCurrent && value.endDate) {
            ctx.addIssue({ code: "custom", path: ["endDate"], message: "Current work must not have an end date" });
          }
        })
      ).max(FIELD_LIMITS.records).optional(),
      educations: z.array(
        z.object({
          school: z.string().trim().min(1).max(FIELD_LIMITS.shortText),
          degree: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
          fieldOfStudy: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
          startDate: nonFutureDate.optional().nullable(),
          endDate: dateOnly.optional().nullable(),
          notes: boundedText(FIELD_LIMITS.notes).optional().nullable(),
        }).superRefine(dateRange)
      ).max(FIELD_LIMITS.records).optional(),
      skills: z.array(z.string().trim().min(1).max(FIELD_LIMITS.label)).max(FIELD_LIMITS.skills).optional(),
      trainings: z.array(
        z.object({
          title: z.string().trim().min(1).max(FIELD_LIMITS.shortText),
          provider: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
          completionDate: nonFutureDate.optional().nullable(),
          certificateNo: boundedText(FIELD_LIMITS.label).optional().nullable(),
          notes: boundedText(FIELD_LIMITS.notes).optional().nullable(),
        })
      ).max(FIELD_LIMITS.records).optional(),
      characterReferences: z.array(
        z.object({
          name: z.string().trim().min(1).max(FIELD_LIMITS.name),
          relationship: boundedText(FIELD_LIMITS.name).optional().nullable(),
          company: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
          phone: phoneValidation,
          email: z.string().email().max(FIELD_LIMITS.email).optional().nullable(),
          notes: boundedText(FIELD_LIMITS.notes).optional().nullable(),
        })
      ).max(FIELD_LIMITS.records).optional(),
    }),
  }),
};

