import { z } from "zod";
import { ApplicationStatus } from "@prisma/client";
import { BACKOUT_REASONS_BY_PARTY, REJECTION_REASON_CODES } from "../services/ta/backout-rules.js";
import { BULK_MAX_IDS } from "../services/ta/bulk-rules.js";
import { resumeMergeAccept } from "./applicant.schema.js";
import { manilaDateString, boundedIdText, boundedText, dateOnly, finiteNumber, FIELD_LIMITS, formattedMobile, formattedPhone, requiredText, safeTextSchema, safeProseSchema, optionalPersonNameSchema, optionalSafeAddress, optionalSafeText, optionalSafeProse, optionalSafeUrl, adultDateOfBirth, sssNumber, philhealthNumber, pagibigNumber, tinNumber, pageQueryFields, isWorkingHours } from "./field-limits.js";

const phoneField = formattedPhone;

const mrfDate = z.union([
  dateOnly,
  z.string().datetime({ offset: true }).max(35),
]);
const salary = finiteNumber({ min: 0, max: 1_000_000, decimals: 2 }).optional().nullable();
const age = finiteNumber({ min: 18, max: 65, integer: true }).optional().nullable();
const BACKOUT_REASON_VALUES = [...new Set(Object.values(BACKOUT_REASONS_BY_PARTY).flat())] as [string, ...string[]];
const idValue = finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true });
const bulkIds = z.array(idValue).min(1, "Select at least one record").max(BULK_MAX_IDS, `Select at most ${BULK_MAX_IDS} records at a time`);
// Dropdown values match case-insensitively and are stored as the listed spelling; blank means no selection.
const listedChoice = <T extends string>(options: readonly T[], message: string) =>
  z.preprocess(
    (value) => (typeof value === "string" ? options.find((option) => option.toLowerCase() === value.trim().toLowerCase()) ?? (value.trim() === "" ? "" : value) : value),
    z.enum(["", ...options] as [string, ...string[]], { message }),
  ).optional().nullable();
export const walkInGender = listedChoice(["Male", "Female", "Non-Binary", "Prefer not to say"], "Select a gender from the list.");
// Update schemas may leave a required field out, but a blank or null value would overwrite it.
const omittedOrNonBlank = (value: unknown) => value === undefined || (typeof value === "string" && value.length > 0);

// Verify details rows (TA edit). Same limits as the applicant's own work, education and skill forms.
const reviewPastDate = dateOnly.refine((value) => value <= manilaDateString(), "Date cannot be in the future");
const reviewDateRange = (value: { startDate?: string | null; endDate?: string | null }, ctx: z.RefinementCtx) => {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after start date" });
  }
};
const optionalReviewDate = z.union([reviewPastDate, z.literal("")]).optional().nullable();
const reviewRequiredRowId = finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true });
const reviewRowId = reviewRequiredRowId.optional();
const reviewRowIds = z.array(reviewRequiredRowId).max(FIELD_LIMITS.records).optional();
const reviewWorkExperience = z.object({
  id: reviewRowId,
  company: safeTextSchema("Company", FIELD_LIMITS.shortText),
  roleTitle: safeTextSchema("Job title", FIELD_LIMITS.shortText),
  location: optionalSafeText("Location", FIELD_LIMITS.shortText),
  startDate: reviewPastDate,
  endDate: optionalReviewDate,
  isCurrent: z.boolean().optional(),
  summary: optionalSafeProse("Description", FIELD_LIMITS.notes),
}).strict().superRefine((value, ctx) => {
  reviewDateRange(value, ctx);
  if (value.isCurrent && value.endDate) {
    ctx.addIssue({ code: "custom", path: ["endDate"], message: "Current work must not have an end date" });
  }
});
const reviewEducation = z.object({
  id: reviewRowId,
  school: safeTextSchema("School", FIELD_LIMITS.shortText),
  degree: optionalSafeText("Degree", FIELD_LIMITS.shortText),
  fieldOfStudy: optionalSafeText("Field of study", FIELD_LIMITS.shortText),
  startDate: optionalReviewDate,
  endDate: optionalReviewDate,
  notes: optionalSafeProse("Notes", FIELD_LIMITS.notes),
}).strict().superRefine(reviewDateRange);
const reviewSkills = z.array(z.string().trim().min(1).max(FIELD_LIMITS.label)).max(FIELD_LIMITS.skills)
  .refine((skills) => new Set(skills.map((skill) => skill.toLowerCase())).size === skills.length, "Skills must not contain duplicates");

export const taSchema = {
  idParams: z.object({ params: z.object({ id: boundedIdText }).strict() }),
  createJob: z.object({
    body: z.object({
      title: safeTextSchema("Title", FIELD_LIMITS.shortText),
      description: safeProseSchema("Description", FIELD_LIMITS.longText),
      requirements: safeProseSchema("Requirements", FIELD_LIMITS.longText),
      location: optionalSafeText("Location", FIELD_LIMITS.shortText),
      imageUrl: optionalSafeUrl("Image web address", FIELD_LIMITS.url),
      mrfId: idValue.optional().nullable(),
      isEvergreen: z.boolean().optional(),
      status: z.enum(["DRAFT", "OPEN", "CLOSED"]).optional(),
    }),
  }),
  updateJob: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      title: optionalSafeText("Title", FIELD_LIMITS.shortText),
      description: optionalSafeProse("Description", FIELD_LIMITS.longText),
      requirements: optionalSafeProse("Requirements", FIELD_LIMITS.longText),
      location: optionalSafeText("Location", FIELD_LIMITS.shortText),
      imageUrl: optionalSafeUrl("Image web address", FIELD_LIMITS.url),
      mrfId: idValue.optional().nullable(),
      isEvergreen: z.boolean().optional(),
      status: z.enum(["DRAFT", "OPEN", "CLOSED"]).optional(),
    }),
  }),
  updateStatus: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      status: z.string().trim().min(1, "Status is required").max(FIELD_LIMITS.shortText),
    }),
  }),
  updateApplicationStatus: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      status: z.string().trim().min(1, "Status is required").max(FIELD_LIMITS.shortText),
      reason: boundedText(FIELD_LIMITS.notes).optional(),
      reasonCode: z.enum(REJECTION_REASON_CODES).optional(),
    }),
  }),
  listJobs: z.object({
    query: z.object({
      status: z.enum(["DRAFT", "OPEN", "CLOSED"]).optional(),
      clientId: idValue.optional(),
      search: boundedText(FIELD_LIMITS.search).optional(),
      mineOnly: z.enum(["true", "false"]).optional(),
      page: finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true }).optional(),
      limit: finiteNumber({ min: 1, max: FIELD_LIMITS.pageSize, integer: true }).optional(),
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
      returning: z.enum(["true", "false"]).optional(),
      source: z.enum(["ONLINE", "WALK_IN"]).optional(),
      sort: z.enum(["match", "newest", "oldest", "waiting"]).optional(),
      needsAction: z.enum(["true", "false", "1", "0"]).optional(),
      page: finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true }).optional(),
      limit: finiteNumber({ min: 1, max: FIELD_LIMITS.pageSize, integer: true }).optional(),
      summary: z.enum(["true", "false"]).optional(),
    }).strict(),
  }),
  walkInCheckDuplicate: z.object({
    query: z.object({
      phone: boundedText(30).optional(),
      firstName: boundedText(FIELD_LIMITS.name).optional(),
      lastName: boundedText(FIELD_LIMITS.name).optional(),
      birthDate: dateOnly.optional().or(z.literal("")),
    }).strict(),
  }),
  createWalkIn: z.object({
    body: z.object({
      jobPostingId: idValue,
      firstName: z.string().trim().min(1, "First name is required").max(FIELD_LIMITS.name),
      middleName: optionalPersonNameSchema("Middle name"),
      lastName: z.string().trim().min(1, "Last name is required").max(FIELD_LIMITS.name),
      mobileNumber: boundedText(30).optional().nullable(),
      // Required: walk-in applicants must be 18 to 65 years old.
      birthDate: adultDateOfBirth("Applicant", 65),
      gender: walkInGender,
      existingUserId: z.string().trim().uuid().optional().or(z.literal("")),
    }).strict(),
  }),
  walkInSlip: z.object({ params: z.object({ id: boundedIdText }).strict() }),
  listClients: z.object({
    query: z.object({ isActive: z.enum(["true", "false"]).optional() }).strict(),
  }),
  listMRFs: z.object({
    query: z.object({
      clientId: idValue.optional(),
      status: z.enum(["OPEN", "IN_PROGRESS", "ON_HOLD", "FILLED", "CANCELLED"]).optional(),
      priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
      sortBy: z.enum(["priority", "created_desc", "created_asc", "target_date"]).optional(),
      search: boundedText(FIELD_LIMITS.search).optional(),
      ...pageQueryFields,
    }).strict(),
  }),
  listDeployments: z.object({
    query: z.object({
      clientId: idValue.optional(),
      status: z.enum(["READY_FOR_DEPLOYMENT", "ACTIVE", "ENDED", "CANCELLED", "PENDING_ORIENTATION", "READY", "DISPATCHED", "ENDED_REDEPLOYMENT", "ENDED_SEPARATED"]).optional(),
      search: boundedText(FIELD_LIMITS.search).optional(),
      ...pageQueryFields,
    }).strict(),
  }),
  listInterviewCompliance: z.object({
    query: z.object({
      search: boundedText(FIELD_LIMITS.search).optional(),
      status: z.enum(["HEALTHY", "WARNING", "BREACHED"]).optional(),
      stage: z.enum(["INITIAL_SCREENING", "FINAL_INTERVIEW"]).optional(),
      position: boundedText(FIELD_LIMITS.search).optional(),
      sortField: z.enum(["candidate", "position", "scheduledAt", "deadline"]).optional(),
      sortDirection: z.enum(["asc", "desc"]).optional(),
      ...pageQueryFields,
    }).strict(),
  }),
  recordBackout: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      // Only the applicant backs out; client or agency decisions go through the archive flow.
      party: z.literal("APPLICANT"),
      reason: z.enum(BACKOUT_REASON_VALUES),
      notes: boundedText(FIELD_LIMITS.notes).optional(),
      occurredOn: dateOnly.optional(), // Manila calendar date; defaults to now
      keepInTalentPool: z.boolean().optional(), // defaults to true unless the applicant pulled out
    }).superRefine((body, ctx) => {
      if (!BACKOUT_REASONS_BY_PARTY[body.party].includes(body.reason)) {
        ctx.addIssue({ code: "custom", path: ["reason"], message: `Reason ${body.reason} is not valid when the responsible party is ${body.party}` });
      }
      if (body.reason === "OTHER" && !body.notes) {
        ctx.addIssue({ code: "custom", path: ["notes"], message: "Please describe the reason." });
      }
    }),
  }),
  closeApplication: z.object({
    params: z.object({ id: boundedIdText }),
    body: z
      .object({
        outcome: z.enum(["REJECTED", "BACKED_OUT"]),
        reasonCode: z.string().min(1).max(64),
        disposition: z.enum(["TALENT_POOL", "ARCHIVE"]),
        notes: boundedText(FIELD_LIMITS.notes).optional(),
        occurredOn: dateOnly.optional(), // Backed Out only; Manila calendar date, defaults to now
      })
      .superRefine((body, ctx) => {
        const valid =
          body.outcome === "BACKED_OUT"
            ? (BACKOUT_REASONS_BY_PARTY.APPLICANT as readonly string[]).includes(body.reasonCode)
            : (REJECTION_REASON_CODES as readonly string[]).includes(body.reasonCode);
        if (!valid) {
          ctx.addIssue({ code: "custom", path: ["reasonCode"], message: "Reason is not valid for this outcome" });
        }
        if (body.outcome === "REJECTED" && body.occurredOn) {
          ctx.addIssue({ code: "custom", path: ["occurredOn"], message: "Date only applies to a backout" });
        }
        if (body.reasonCode === "OTHER" && !body.notes) {
          ctx.addIssue({ code: "custom", path: ["notes"], message: "Please describe the reason." });
        }
      }),
  }),
  archiveRestore: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      notes: boundedText(FIELD_LIMITS.notes).optional(),
      reason: boundedText(FIELD_LIMITS.notes).optional(),
    }).optional(),
  }),
  bulkRejectApplications: z.object({
    body: z
      .object({
        ids: bulkIds,
        reasonCode: z.enum(REJECTION_REASON_CODES),
        disposition: z.enum(["TALENT_POOL", "ARCHIVE"]),
        notes: boundedText(FIELD_LIMITS.notes).optional(),
      })
      .superRefine((body, ctx) => {
        if (body.reasonCode === "OTHER" && !body.notes) {
          ctx.addIssue({ code: "custom", path: ["notes"], message: "Please describe the reason." });
        }
      }),
  }),
  bulkArchiveRestoreApplications: z.object({
    body: z.object({
      ids: bulkIds,
      reason: requiredText("Reason", FIELD_LIMITS.notes),
    }),
  }),
  bulkDismissCheckIns: z.object({
    body: z.object({
      ids: bulkIds,
      reason: z.string().trim().min(1, "Give a reason").max(300),
    }),
  }),
  bulkCancelInvitations: z.object({
    body: z.object({ ids: bulkIds }),
  }),
  bulkConfirmDeploymentStart: z.object({
    body: z.object({
      items: z.array(z.object({ id: idValue, actualStart: dateOnly })).min(1, "Select at least one deployment").max(BULK_MAX_IDS, `Select at most ${BULK_MAX_IDS} deployments at a time`),
      notes: boundedText(FIELD_LIMITS.notes).optional(),
    }),
  }),
  bulkEndDeployments: z.object({
    body: z.object({
      ids: bulkIds,
      actualEnd: dateOnly,
      reason: z.string().trim().min(1, "Reason is required").max(FIELD_LIMITS.notes),
      disposition: z.enum(["AVAILABLE_FOR_REDEPLOYMENT", "NOT_CONFIRMED", "SEPARATED"]),
    }),
  }),
  bulkRecordInterviews: z.object({
    body: z.object({
      items: z.array(z.object({ applicationId: idValue, interviewId: idValue })).min(1, "Select at least one interview").max(BULK_MAX_IDS, `Select at most ${BULK_MAX_IDS} interviews at a time`),
      // Fail needs a note per candidate, so it stays one by one.
      result: z.enum(["PASS", "NO_SHOW"]),
      notes: boundedText(FIELD_LIMITS.notes).optional(),
    }),
  }),
  scheduleInterview: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      type: z.enum(["INITIAL_SCREENING", "FINAL_INTERVIEW"]),
      scheduledAt: z
        .string()
        .datetime({ offset: true })
        .max(35)
        .refine(
          (val) => isWorkingHours(val),
          "Interviews must be scheduled during strictly working hours (9:00 AM to 5:00 PM Manila time)."
        ),
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
  downloadContractPdf: z.object({
    params: z.object({ id: boundedIdText }),
    query: z.object({ startDate: dateOnly.optional() }).strict(),
  }),
  uploadSignedContract: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({ startDate: dateOnly }),
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
      actualStart: dateOnly.optional(),
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
      // Keep .optional() outside optionalSafeUrl: its transform maps an absent value to null, which would clear the stored link.
      contractDocumentUrl: optionalSafeUrl("Contract document web address", FIELD_LIMITS.url).optional(),
      contractTerms: boundedText(FIELD_LIMITS.longText).optional().nullable(),
      // FULLY_EXECUTED is set only by signDeploymentContract once both parties have signed.
      contractStatus: z.enum(["PENDING_REVIEW", "PENDING_SIGNATURES", "WORKER_SIGNED", "CLIENT_SIGNED"]).optional().nullable(),
      contractEnd: dateOnly.optional().nullable(),
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
  // The document arrives as a multipart file, so the body carries no other fields.
  uploadComplianceDocument: z.object({
    params: z.object({ requirementId: boundedIdText }),
    body: z.object({}).strict().optional(),
  }),
  reviewComplianceRequirement: z.object({
    params: z.object({ requirementId: boundedIdText }),
    body: z.object({
      reviewStatus: z.enum(["APPROVED", "REJECTED", "PENDING", "EXPIRED", "TO_FOLLOW", "SUBMITTED"]),
      reviewNotes: boundedText(FIELD_LIMITS.notes).optional().nullable(),
      expiresAt: dateOnly.optional().nullable(),
      issuedAt: dateOnly.optional().nullable(),
      validityStatus: z.enum(["UNKNOWN", "HAS_EXPIRY", "NO_EXPIRY"]).optional(),
      toFollowExpectedAt: dateOnly.optional().nullable(),
    }).strict(),
  }),
  requestDocumentUpdate: z.object({
    params: z.object({ requirementId: boundedIdText }).strict(),
    body: z.object({ reason: z.string().trim().min(1).max(FIELD_LIMITS.notes), deadline: dateOnly }).strict(),
  }),
  updateComplianceDeadline: z.object({
    params: z.object({ requirementId: boundedIdText }),
    body: z.object({ deadline: dateOnly.optional().nullable() }).strict(),
  }),
  deleteComplianceRequirement: z.object({
    params: z.object({ requirementId: boundedIdText }),
  }),
  complianceQueueQuery: z.object({
    query: z.object({
      scope: z.enum(["PRE_DEPLOYMENT", "POST_DEPLOYMENT", "ALL"]).optional(),
    }).strict(),
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
      title: safeTextSchema("MRF title", FIELD_LIMITS.shortText),
      headcount: finiteNumber({ min: 1, max: 1000, integer: true }).optional(),
      priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
      location: optionalSafeText("Location", FIELD_LIMITS.shortText),
      targetFillDate: mrfDate.optional().nullable(),
      requiredSkills: optionalSafeProse("Required skills", FIELD_LIMITS.notes),
      requiredExperience: optionalSafeText("Required experience", FIELD_LIMITS.shortText),
      requiredEducation: optionalSafeText("Required education", FIELD_LIMITS.shortText),
      requiredCertifications: optionalSafeProse("Required certifications", FIELD_LIMITS.notes),
      description: optionalSafeProse("MRF description", FIELD_LIMITS.longText),
      salaryRangeMin: salary,
      salaryRangeMax: salary,
      employmentType: optionalSafeText("Employment type", FIELD_LIMITS.shortText),
      workArrangement: optionalSafeText("Work arrangement", FIELD_LIMITS.shortText),
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
      title: optionalSafeText("MRF title", FIELD_LIMITS.shortText).refine(omittedOrNonBlank, "Request title is required."),
      headcount: finiteNumber({ min: 1, max: 1000, integer: true }).optional(),
      priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
      location: optionalSafeText("Location", FIELD_LIMITS.shortText),
      targetFillDate: mrfDate.optional().nullable(),
      requiredSkills: optionalSafeProse("Required skills", FIELD_LIMITS.notes),
      requiredExperience: optionalSafeText("Required experience", FIELD_LIMITS.shortText),
      requiredEducation: optionalSafeText("Required education", FIELD_LIMITS.shortText),
      requiredCertifications: optionalSafeProse("Required certifications", FIELD_LIMITS.notes),
      description: optionalSafeProse("MRF description", FIELD_LIMITS.longText),
      salaryRangeMin: salary,
      salaryRangeMax: salary,
      employmentType: optionalSafeText("Employment type", FIELD_LIMITS.shortText),
      workArrangement: optionalSafeText("Work arrangement", FIELD_LIMITS.shortText),
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
      name: safeTextSchema("Company name", FIELD_LIMITS.shortText),
      tradeName: optionalSafeText("Brand name", FIELD_LIMITS.shortText),
      industry: optionalSafeText("Industry", FIELD_LIMITS.shortText),
      contactName: optionalPersonNameSchema("Contact name"),
      contactEmail: z
        .string()
        .trim()
        .toLowerCase()
        .email("Invalid email format")
        .max(FIELD_LIMITS.email)
        .optional()
        .nullable()
        .or(z.literal("")),
      contactPhone: phoneField,
      address: optionalSafeAddress("Address"),
      street: optionalSafeAddress("Street"),
      barangay: optionalSafeText("Barangay", FIELD_LIMITS.barangay),
      city: optionalSafeText("City", FIELD_LIMITS.name),
      province: optionalSafeText("Province", FIELD_LIMITS.name),
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
  candidateResumeProposal: z.object({
    params: z.object({ id: z.string().min(1).max(128) }).strict(),
  }),
  reparseCandidateResume: z.object({
    params: z.object({ id: z.string().min(1).max(128) }).strict(),
    body: z.object({ documentId: z.number().int().positive().optional() }).strict(),
  }),
  applyCandidateResumeMerge: z.object({
    params: z.object({ id: z.string().min(1).max(128), parseId: boundedIdText }).strict(),
    body: z.object({ accept: resumeMergeAccept }).strict(),
  }),
  updateCandidateProfile: z.object({
    params: z.object({ id: z.string().min(1).max(128) }),
    body: z.object({
      firstName: optionalPersonNameSchema("First Name"),
      lastName: optionalPersonNameSchema("Last Name"),
      middleName: optionalPersonNameSchema("Middle Name"),
      mobileNumber: formattedMobile,
      dateOfBirth: z.union([adultDateOfBirth("Candidate"), z.literal("")]).optional().nullable(),
      gender: listedChoice(["Male", "Female", "Non-Binary", "Prefer not to say"], "Select a gender from the list."),
      city: optionalSafeText("City", FIELD_LIMITS.name),
      province: optionalSafeText("Province", FIELD_LIMITS.name),
      barangay: optionalSafeText("Barangay", FIELD_LIMITS.barangay),
      postalCode: z.string().regex(/^\d{4}$/).optional().nullable(),
      tattooStatus: z.enum(["NONE", "NON_VISIBLE", "VISIBLE"]).optional().nullable(),
      sss: sssNumber,
      philhealth: philhealthNumber,
      pagibig: pagibigNumber,
      tin: tinNumber,
      address: optionalSafeAddress("Residential Address"),
      emergencyContactName: optionalPersonNameSchema("Emergency Contact Name"),
      emergencyContactPhone: phoneField,
      emergencyContactRelationship: optionalSafeText("Emergency Contact Relationship", FIELD_LIMITS.name),
      emergencyContactAddress: optionalSafeAddress("Emergency Contact Address"),
      professionalSummary: optionalSafeProse("Professional Summary", FIELD_LIMITS.summary),
      // Rows to create (no id) or update (id). Rows not listed are left alone.
      workExperiences: z.array(reviewWorkExperience).max(FIELD_LIMITS.records).optional(),
      removeWorkExperienceIds: reviewRowIds,
      educations: z.array(reviewEducation).max(FIELD_LIMITS.records).optional(),
      removeEducationIds: reviewRowIds,
      skills: reviewSkills.optional(),
      // Accepted and ignored for one release so an older client does not get a 400. Nothing is marked verified.
      markVerified: z.boolean().optional(),
    }).strict(),
  }),
  updateClient: z.object({
    params: z.object({ id: boundedIdText }),
    body: z.object({
      name: optionalSafeText("Company name", FIELD_LIMITS.shortText).refine(omittedOrNonBlank, "Client name is required."),
      tradeName: optionalSafeText("Brand name", FIELD_LIMITS.shortText),
      industry: optionalSafeText("Industry", FIELD_LIMITS.shortText),
      contactName: optionalPersonNameSchema("Contact name"),
      contactEmail: z
        .string()
        .trim()
        .toLowerCase()
        .email("Invalid email format")
        .max(FIELD_LIMITS.email)
        .optional()
        .nullable()
        .or(z.literal("")),
      contactPhone: phoneField,
      address: optionalSafeAddress("Address"),
      street: optionalSafeAddress("Street"),
      barangay: optionalSafeText("Barangay", FIELD_LIMITS.barangay),
      city: optionalSafeText("City", FIELD_LIMITS.name),
      province: optionalSafeText("Province", FIELD_LIMITS.name),
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
