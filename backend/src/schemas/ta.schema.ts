import { z } from "zod";
import { ApplicationStatus } from "@prisma/client";
import { boundedIdText, boundedText, dateOnly, finiteNumber, FIELD_LIMITS, formattedDigits, formattedMobile, formattedPhone, requiredText } from "./field-limits.js";

const phoneField = formattedPhone;

const mrfDate = z.union([
  dateOnly,
  z.string().datetime({ offset: true }).max(35),
]);
const salary = finiteNumber({ min: 0, max: 1_000_000, decimals: 2 }).optional().nullable();
const age = finiteNumber({ min: 18, max: 65, integer: true }).optional().nullable();
const idValue = finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true });

export const taSchema = {
  idParams: z.object({ params: z.object({ id: boundedIdText }).strict() }),
  createJob: z.object({
    body: z.object({
      title: requiredText("Title", FIELD_LIMITS.shortText),
      description: requiredText("Description", FIELD_LIMITS.longText),
      requirements: requiredText("Requirements", FIELD_LIMITS.longText),
      location: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      status: z.enum(["DRAFT", "OPEN", "CLOSED"]).optional(),
    }),
  }),
  updateJob: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      title: boundedText(FIELD_LIMITS.shortText).optional(),
      description: boundedText(FIELD_LIMITS.longText).optional(),
      requirements: boundedText(FIELD_LIMITS.longText).optional(),
      location: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      status: z.enum(["DRAFT", "OPEN", "CLOSED"]).optional(),
    }),
  }),
  updateStatus: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      status: z.string().trim().min(1, "Status is required").max(FIELD_LIMITS.shortText),
    }),
  }),
  listJobs: z.object({
    query: z.object({
      status: z.enum(["DRAFT", "OPEN", "CLOSED"]).optional(),
      clientId: idValue.optional(),
      search: boundedText(FIELD_LIMITS.search).optional(),
      mineOnly: z.enum(["true", "false"]).optional(),
    }).strict(),
  }),
  listApplications: z.object({
    query: z.object({
      status: z.nativeEnum(ApplicationStatus).optional(),
      jobPostingId: idValue.optional(),
      jobId: idValue.optional(),
      clientId: idValue.optional(),
      search: boundedText(FIELD_LIMITS.search).optional(),
      isArchived: z.enum(["true", "false"]).optional(),
      mineOnly: z.enum(["true", "false"]).optional(),
      page: finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true }).optional(),
      limit: finiteNumber({ min: 1, max: FIELD_LIMITS.pageSize, integer: true }).optional(),
    }).strict(),
  }),
  listClients: z.object({
    query: z.object({ isActive: z.enum(["true", "false"]).optional() }).strict(),
  }),
  listMRFs: z.object({
    query: z.object({
      clientId: idValue.optional(),
      status: z.enum(["OPEN", "IN_PROGRESS", "ON_HOLD", "FILLED", "CANCELLED"]).optional(),
      priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
      sortBy: z.enum(["priority", "created_desc", "created_asc", "target_date"]).optional(),
    }).strict(),
  }),
  listDeployments: z.object({
    query: z.object({
      clientId: idValue.optional(),
      status: z.enum(["READY_FOR_DEPLOYMENT", "ACTIVE", "ENDED", "CANCELLED", "PENDING_ORIENTATION", "READY", "DISPATCHED"]).optional(),
    }).strict(),
  }),
  archiveRestore: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      notes: boundedText(FIELD_LIMITS.notes).optional(),
    }).optional(),
  }),
  scheduleInterview: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      type: z.enum(["INITIAL_SCREENING", "FINAL_INTERVIEW"]),
      scheduledAt: z.string().datetime({ offset: true }).max(35),
      notes: boundedText(FIELD_LIMITS.notes).optional(),
    }).strict(),
  }),
  updateInterviewStatus: z.object({
    params: z.object({ id: boundedIdText, interviewId: boundedIdText }),
    body: z.object({
      result: z.enum(["PASS", "PASSED", "FAIL", "FAILED", "NO_SHOW", "PENDING"]),
      conductedAt: z.string().datetime({ offset: true }).max(35).optional().nullable(),
      notes: boundedText(FIELD_LIMITS.notes).optional(),
    }),
  }),
  recordInterview: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      type: z.string().trim().min(1, "Type is required").max(FIELD_LIMITS.shortText),
      result: z.string().trim().min(1, "Result is required").max(FIELD_LIMITS.shortText),
      conductedAt: z.string().datetime({ offset: true }).max(35).optional().nullable(),
      notes: boundedText(FIELD_LIMITS.notes).optional(),
    }),
  }),
  uploadPostHireDocument: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      label: requiredText("Label", FIELD_LIMITS.label),
      notes: boundedText(FIELD_LIMITS.notes).optional(),
    }),
  }),
  endorseCandidate: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      clientId: idValue.optional(),
      outcome: z.enum(["PENDING", "APPROVED", "DECLINED", "ENDORSED"]).optional().default("PENDING"),
      notes: boundedText(FIELD_LIMITS.notes).optional(),
    }),
  }),
  updateEndorsement: z.object({
    params: z.object({ id: boundedIdText, endorsementId: boundedIdText }),
    body: z.object({
      outcome: z.enum(["PENDING", "APPROVED", "DECLINED", "ENDORSED"]),
      notes: boundedText(FIELD_LIMITS.notes).optional(),
    }),
  }),
  createComplianceTemplate: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      documentLabel: requiredText("Document label", FIELD_LIMITS.label),
      isRequired: z.boolean().optional(),
    }),
  }),
  createComplianceTemplatesBulk: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      documentLabels: z
        .array(requiredText("Document label", FIELD_LIMITS.label))
        .min(1, "At least one document label is required")
        .max(50, "Cannot add more than 50 requirements at once"),
      isRequired: z.boolean().optional(),
    }),
  }),
  signContract: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      contractNotes: boundedText(FIELD_LIMITS.notes).optional(),
      contractDocumentUrl: z.string().max(FIELD_LIMITS.url).optional(),
    }),
  }),
  completeOrientation: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      orientationDate: dateOnly.optional(),
      orientationNotes: boundedText(FIELD_LIMITS.notes).optional(),
    }),
  }),
  linkJobToMRF: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      jobPostingId: idValue.optional(),
      jobId: idValue.optional(),
    }).strict().refine((value) => Boolean(value.jobPostingId || value.jobId), "A job posting ID is required"),
  }),
  deleteMrfComplianceTemplate: z.object({
    params: z.object({ templateId: boundedIdText }),
  }),
  updateDeploymentStatus: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      status: z.enum(["READY_FOR_DEPLOYMENT", "ACTIVE", "ENDED", "CANCELLED"]),
      notes: boundedText(FIELD_LIMITS.notes).optional().nullable(),
    }).strict(),
  }),
  signDeploymentContract: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      party: z.enum(["WORKER", "CLIENT"]),
      notes: boundedText(FIELD_LIMITS.notes).optional().nullable(),
    }).strict(),
  }),
  updateDeploymentContract: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      contractDocumentUrl: z.string().max(FIELD_LIMITS.url).optional().nullable(),
      contractTerms: boundedText(FIELD_LIMITS.longText).optional().nullable(),
      contractStatus: z.enum(["PENDING_REVIEW", "PENDING_SIGNATURES", "WORKER_SIGNED", "CLIENT_SIGNED", "FULLY_EXECUTED"]).optional().nullable(),
    }).strict(),
  }),
  fastTrackRedeployment: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({ targetStage: z.enum(["FINAL_INTERVIEW", "COMPLIANCE"]).optional() }).strict().optional(),
  }),
  createComplianceRequirement: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      documentLabel: requiredText("Document label", FIELD_LIMITS.label),
      isRequired: z.boolean().optional(),
      deadline: dateOnly.optional().nullable(),
    }).strict(),
  }),
  submitComplianceDocument: z.object({
    params: z.object({ requirementId: boundedIdText }),
    body: z.object({ documentId: idValue }).strict(),
  }),
  reviewComplianceRequirement: z.object({
    params: z.object({ requirementId: boundedIdText }),
    body: z.object({
      reviewStatus: z.enum(["APPROVED", "REJECTED", "PENDING", "EXPIRED", "TO_FOLLOW", "SUBMITTED"]),
      reviewNotes: boundedText(FIELD_LIMITS.notes).optional().nullable(),
      expiresAt: dateOnly.optional().nullable(),
      toFollowExpectedAt: dateOnly.optional().nullable(),
    }).strict(),
  }),
  updateComplianceDeadline: z.object({
    params: z.object({ requirementId: boundedIdText }),
    body: z.object({ deadline: dateOnly.optional().nullable() }).strict(),
  }),
  deleteComplianceRequirement: z.object({
    params: z.object({ requirementId: boundedIdText }),
  }),
  createDeployment: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      clientId: idValue,
      mrfId: idValue.optional().nullable(),
      site: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      contractStart: dateOnly,
      contractEnd: dateOnly.optional().nullable(),
      notes: boundedText(FIELD_LIMITS.notes).optional().nullable(),
    }).strict().superRefine((value, ctx) => {
      if (value.contractEnd && value.contractStart > value.contractEnd) {
        ctx.addIssue({ code: "custom", path: ["contractEnd"], message: "Contract end must be on or after the start date" });
      }
    }),
  }),
  createMRF: z.object({
    body: z.object({
      clientId: finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true }),
      title: z.string().trim().min(1).max(FIELD_LIMITS.shortText),
      headcount: finiteNumber({ min: 1, max: 1000, integer: true }).optional(),
      priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
      location: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      targetFillDate: mrfDate.optional().nullable(),
      requiredSkills: boundedText(FIELD_LIMITS.notes).optional().nullable(),
      requiredExperience: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      requiredEducation: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      requiredCertifications: boundedText(FIELD_LIMITS.notes).optional().nullable(),
      description: boundedText(FIELD_LIMITS.longText).optional().nullable(),
      salaryRangeMin: salary,
      salaryRangeMax: salary,
      employmentType: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      workArrangement: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      ageMin: age,
      ageMax: age,
      genderPreference: z.enum(["ANY", "MALE", "FEMALE"]).optional(),
      tattooPolicy: z.enum(["ALLOWED", "NO_VISIBLE", "NONE"]).optional(),
    }).strict().superRefine((value, ctx) => {
      if (value.salaryRangeMin != null && value.salaryRangeMax != null && value.salaryRangeMin > value.salaryRangeMax) {
        ctx.addIssue({ code: "custom", path: ["salaryRangeMax"], message: "Maximum salary cannot be less than minimum salary" });
      }
      if (value.ageMin != null && value.ageMax != null && value.ageMin > value.ageMax) {
        ctx.addIssue({ code: "custom", path: ["ageMax"], message: "Maximum age cannot be less than minimum age" });
      }
    }),
  }),
  updateMRF: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      title: z.string().trim().min(1).max(FIELD_LIMITS.shortText).optional(),
      headcount: finiteNumber({ min: 1, max: 1000, integer: true }).optional(),
      priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
      location: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      targetFillDate: mrfDate.optional().nullable(),
      requiredSkills: boundedText(FIELD_LIMITS.notes).optional().nullable(),
      requiredExperience: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      requiredEducation: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      requiredCertifications: boundedText(FIELD_LIMITS.notes).optional().nullable(),
      description: boundedText(FIELD_LIMITS.longText).optional().nullable(),
      salaryRangeMin: salary,
      salaryRangeMax: salary,
      employmentType: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      workArrangement: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      ageMin: age,
      ageMax: age,
      genderPreference: z.enum(["ANY", "MALE", "FEMALE"]).optional(),
      tattooPolicy: z.enum(["ALLOWED", "NO_VISIBLE", "NONE"]).optional(),
      status: z.enum(["OPEN", "IN_PROGRESS", "ON_HOLD", "FILLED", "CANCELLED"]).optional(),
    }).strict().superRefine((value, ctx) => {
      if (value.salaryRangeMin != null && value.salaryRangeMax != null && value.salaryRangeMin > value.salaryRangeMax) {
        ctx.addIssue({ code: "custom", path: ["salaryRangeMax"], message: "Maximum salary cannot be less than minimum salary" });
      }
      if (value.ageMin != null && value.ageMax != null && value.ageMin > value.ageMax) {
        ctx.addIssue({ code: "custom", path: ["ageMax"], message: "Maximum age cannot be less than minimum age" });
      }
    }),
  }),
  createClient: z.object({
    body: z.object({
      name: z.string().trim().min(1, "Company name is required").max(FIELD_LIMITS.shortText),
      tradeName: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      industry: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      contactName: boundedText(FIELD_LIMITS.name).optional().nullable(),
      contactEmail: z
        .string()
        .email("Invalid email format")
        .max(FIELD_LIMITS.email)
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
      contactPhone: phoneField,
      address: boundedText(FIELD_LIMITS.address).optional().nullable(),
      street: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      barangay: boundedText(FIELD_LIMITS.barangay).optional().nullable(),
      city: boundedText(FIELD_LIMITS.name).optional().nullable(),
      province: boundedText(FIELD_LIMITS.name).optional().nullable(),
      postalCode: z
        .string()
        .optional()
        .nullable()
        .refine(
          (val) => {
            if (!val || val.trim() === "") return true;
            return /^\d{4}$/.test(val.trim());
          },
          {
            message: "Postal code must be exactly 4 digits",
          }
        ),
      reviewThresholdDays: finiteNumber({ min: 1, max: 30, integer: true }).optional(),
      medicalValidityMonths: finiteNumber({ min: 1, max: 36, integer: true }).optional(),
    }),
  }),
  updateCandidateProfile: z.object({
    params: z.object({ id: z.string().min(1).max(128) }),
    body: z.object({
      firstName: z.string().trim().min(1).max(FIELD_LIMITS.name).optional(),
      lastName: z.string().trim().min(1).max(FIELD_LIMITS.name).optional(),
      middleName: boundedText(FIELD_LIMITS.name).optional().nullable(),
      mobileNumber: formattedMobile,
      dateOfBirth: z.string().max(35).optional().nullable(),
      gender: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      city: boundedText(FIELD_LIMITS.name).optional().nullable(),
      province: boundedText(FIELD_LIMITS.name).optional().nullable(),
      barangay: boundedText(FIELD_LIMITS.barangay).optional().nullable(),
      postalCode: z.string().regex(/^\d{4}$/).optional().nullable(),
      tattooStatus: z.enum(["NONE", "NON_VISIBLE", "VISIBLE"]).optional().nullable(),
      sss: formattedDigits(0, 10),
      philhealth: formattedDigits(0, 12),
      pagibig: formattedDigits(0, 12),
      tin: formattedDigits(9, 12),
      address: boundedText(FIELD_LIMITS.address).optional().nullable(),
      emergencyContactName: boundedText(FIELD_LIMITS.name).optional().nullable(),
      emergencyContactPhone: phoneField,
      emergencyContactRelationship: boundedText(FIELD_LIMITS.name).optional().nullable(),
      emergencyContactAddress: boundedText(FIELD_LIMITS.address).optional().nullable(),
    }).strict(),
  }),
  updateClient: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      name: z.string().trim().min(1, "Company name is required").max(FIELD_LIMITS.shortText).optional(),
      tradeName: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      industry: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      contactName: boundedText(FIELD_LIMITS.name).optional().nullable(),
      contactEmail: z
        .string()
        .email("Invalid email format")
        .max(FIELD_LIMITS.email)
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
      contactPhone: phoneField,
      address: boundedText(FIELD_LIMITS.address).optional().nullable(),
      street: boundedText(FIELD_LIMITS.shortText).optional().nullable(),
      barangay: boundedText(FIELD_LIMITS.barangay).optional().nullable(),
      city: boundedText(FIELD_LIMITS.name).optional().nullable(),
      province: boundedText(FIELD_LIMITS.name).optional().nullable(),
      postalCode: z
        .string()
        .optional()
        .nullable()
        .refine(
          (val) => {
            if (!val || val.trim() === "") return true;
            return /^\d{4}$/.test(val.trim());
          },
          {
            message: "Postal code must be exactly 4 digits",
          }
        ),
      isActive: z.boolean().optional(),
      reviewThresholdDays: finiteNumber({ min: 1, max: 30, integer: true }).optional(),
      medicalValidityMonths: finiteNumber({ min: 1, max: 36, integer: true }).optional(),
    }),
  }),
};
