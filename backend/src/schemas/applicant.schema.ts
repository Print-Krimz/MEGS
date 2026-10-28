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
  adultDateOfBirth,
  sssNumber,
  philhealthNumber,
  pagibigNumber,
  tinNumber,
} from "./field-limits.js";

const nonFutureDate = dateOnly.refine((value) => value <= manilaDateString(), "Date cannot be in the future");
const pastDate = dateOnly.refine((value) => value < manilaDateString(), "Date must be earlier than today");
const dateRange = (value: { startDate?: string | null; endDate?: string | null }, ctx: z.RefinementCtx) => {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after start date" });
  }
};
const phoneValidation = formattedPhone;
// Dropdown values match case-insensitively (resume extraction may return "male"); the stored value is the listed spelling.
const listedChoice = <T extends string>(options: readonly T[], message: string) =>
  z.preprocess(
    (value) => (typeof value === "string" ? options.find((option) => option.toLowerCase() === value.trim().toLowerCase()) ?? (value.trim() === "" ? "" : value) : value),
    z.enum(["", ...options] as [string, ...string[]], { message }),
  ).optional().nullable();
// Absent, null or blank values fail the required check; otherwise the same name rules apply.
const requiredProfileName = (label: string, message: string) =>
  z.intersection(z.string({ message }).trim().min(1, message), optionalPersonNameSchema(label));

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

const idList = z.array(z.number().int().min(0).max(500)).max(100).default([]);
const nameList = z.array(z.string().trim().min(1).max(200)).max(200).default([]);
export const resumeMergeAccept = z
  .object({
    personal: nameList,
    overwrite: nameList,
    workExperiences: idList,
    educations: idList,
    skills: nameList,
    trainings: idList,
    references: idList,
  })
  .strict();

export const applicantSchema = {
  idParams: z.object({ params: z.object({ id: boundedIdText }).strict() }),
  applyResumeMerge: z.object({
    params: z.object({ parseId: boundedIdText }).strict(),
    body: z.object({ accept: resumeMergeAccept }).strict(),
  }),
  emptyUploadBody: z.object({ body: z.object({}).strict().optional() }),
  upsertProfile: z.object({
    body: z.object({
      firstName: requiredProfileName("First Name", "First name is required."),
      middleName: optionalPersonNameSchema("Middle Name"),
      lastName: requiredProfileName("Last Name", "Last name is required."),
      mobileNumber: formattedMobile.refine((value) => Boolean(value?.trim()), "Mobile number is required."),
      gender: listedChoice(["Male", "Female", "Non-Binary", "Prefer not to say"], "Select a gender from the list."),
      province: optionalSafeText("Province", FIELD_LIMITS.name),
      city: optionalSafeText("City", FIELD_LIMITS.name),
      barangay: optionalSafeText("Barangay", FIELD_LIMITS.barangay),
      postalCode: z.union([z.string().regex(/^\d{4}$/, "Postal code must be exactly 4 digits"), z.literal("")]).optional().nullable(),
      dateOfBirth: z.union([adultDateOfBirth("Applicant"), z.literal("")]).optional().nullable(),
      birthPlace: optionalSafeText("Birth Place", FIELD_LIMITS.shortText),
      nationality: optionalSafeText("Nationality", FIELD_LIMITS.name),
      civilStatus: listedChoice(["Single", "Married", "Widowed", "Separated", "Divorced"], "Select a civil status from the list."),
      height: heightValidation,
      weight: weightValidation,
      religion: optionalSafeText("Religion", FIELD_LIMITS.shortText),
      address: optionalSafeAddress("Residential Address"),
      preferredWorkLocations: optionalSafeText("Preferred Work Locations", FIELD_LIMITS.notes),
      pagibig: pagibigNumber,
      philhealth: philhealthNumber,
      sss: sssNumber,
      tin: tinNumber,
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
      company: optionalSafeText("Company", FIELD_LIMITS.name),
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
  listSavedJobsQuery: z.object({
    search: boundedText(FIELD_LIMITS.search).optional(),
    location: boundedText(FIELD_LIMITS.shortText).optional(),
    salaryMin: finiteNumber({ min: 0, max: 1_000_000, decimals: 2 }).optional(),
    salaryMax: finiteNumber({ min: 0, max: 1_000_000, decimals: 2 }).optional(),
    department: boundedText(FIELD_LIMITS.shortText).optional(),
    page: finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true }).optional(),
    limit: boundedPageSize.optional(),
  }),
};

export const listSavedJobsQuerySchema = applicantSchema.listSavedJobsQuery;
