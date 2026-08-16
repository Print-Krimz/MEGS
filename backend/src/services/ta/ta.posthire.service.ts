import prisma from '../../utils/prisma.js';
import { uploadFileToSupabase } from '../../middleware/upload.middleware.js';
import { updateTAApplicationStatus } from './ta.applications.service.js';
import { generateComplianceRequirementsFromMRF } from './ta.compliance.service.js';

export const updateToOnboarding = async (applicationId: number, actorId?: string, reason?: string) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
  });

  if (!application) throw new Error("Application not found");
  if (application.isArchived) throw new Error("Cannot onboard an archived application");

  // Route through state machine to COMPLIANCE
  return await updateTAApplicationStatus(
    applicationId,
    "COMPLIANCE",
    actorId,
    reason || "Moved candidate to compliance / onboarding"
  );
};

export const savePostHireDocument = async (applicationId: number, label: string, file: any, notes?: string) => {
  if (!file) throw new Error("No file provided");
  if (!label) throw new Error("Label is required (e.g., 'Medical Certificate')");

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
  });

  if (!application) throw new Error("Application not found");

  const folderPath = `post-hire/${applicationId}`;
  const fileUrl = await uploadFileToSupabase("applicant-assets", folderPath, file);

  return await prisma.postHireDocument.create({
    data: {
      applicationId,
      label,
      fileUrl,
      notes,
    },
  });
};

// Transitions status to HIRED and creates Employee & EmploymentEvent records atomically in a transaction
export const executeHiring = async (
  applicationId: number,
  data: {
    employeeNumber?: string;
    employeeId?: string; // support legacy alias
    department?: string;
    position?: string;
    startDate?: string | Date;
    notes?: string;
    reason?: string;
  },
  actorId?: string
) => {
  const { department, position, startDate, notes, reason } = data;
  const rawEmpNum = data.employeeNumber || data.employeeId;

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      jobPosting: {
        include: {
          mrf: true,
        },
      },
      hiredEmployee: true,
      user: { select: { applicantProfile: { select: { id: true } } } },
    },
  });

  if (!application) throw new Error("Application not found");
  if (application.isArchived) throw new Error("Cannot hire an archived application");
  if (application.hiredEmployee) throw new Error("This application has already produced an employee record");

  const resolvedDepartment =
    department ||
    application.jobPosting?.mrf?.title ||
    "General";


  const resolvedPosition =
    position ||
    application.jobPosting?.title ||
    application.jobPosting?.mrf?.title ||
    "Specialist";

  // Enforce required passed FINAL_INTERVIEW unless already in post-interview stage
  const isPostInterview = ["HIRED", "ONBOARDING", "COMPLIANCE", "DEPLOYED"].includes(application.status);
  if (!isPostInterview) {
    const finalInterview = await prisma.interview.findFirst({
      where: { applicationId, type: "FINAL_INTERVIEW", result: { in: ["PASS", "PASSED"] }, isActive: true },
    });
    if (!finalInterview) {
      throw new Error("Cannot complete hiring. A passed FINAL_INTERVIEW is required.");
    }
  }

  // Check if Candidate (User) is already an Employee
  const existingEmployee = await prisma.employee.findUnique({
    where: { userId: application.userId },
  });

  if (existingEmployee) {
    throw new Error("This candidate already exists as an employee in the system.");
  }

  const generatedEmployeeNumber =
    rawEmpNum ||
    `EMP-${new Date().getFullYear()}-${String(application.id).padStart(4, "0")}`;

  const result = await prisma.$transaction(async (tx) => {
    const nextStatus = application.status === "DEPLOYED" ? "DEPLOYED" : "HIRED";
    const app = await tx.application.update({
      where: { id: applicationId },
      data: { status: nextStatus },
    });

    const employee = await tx.employee.create({
      data: {
        userId: application.userId,
        employeeNumber: generatedEmployeeNumber,
        department: resolvedDepartment,
        position: resolvedPosition,
        hireDate: startDate ? new Date(startDate) : new Date(),
        originatingApplicationId: applicationId,
        notes,
        status: "ACTIVE",
      },
    });

    await tx.employmentEvent.create({
      data: {
        employeeId: employee.id,
        eventType: "HIRED",
        description: reason || `Hired for position ${position || "Specialist"}`,
        effectiveDate: startDate ? new Date(startDate) : new Date(),
        actorId,
        metadata: {
          applicationId,
          department,
          position,
          employeeNumber: employee.employeeNumber,
        },
      },
    });

    const resolvedActorId = actorId || application.userId;
    await tx.recruiterDecision.create({
      data: {
        applicationId,
        actorId: resolvedActorId,
        fromStatus: application.status,
        toStatus: "HIRED",
        reason: reason || "Hiring process completed and Employee created",
      },
    });

    // Update TalentPoolMembership to PLACED
    if (application.user?.applicantProfile?.id) {
      await tx.talentPoolMembership.updateMany({
        where: { applicantProfileId: application.user.applicantProfile.id },
        data: {
          status: "PLACED",
          availability: "UNAVAILABLE",
        },
      });
    }

    return { application: app, employee };
  });

  // Post-hiring hook: Auto generate compliance checklist from MRF template
  try {
    await generateComplianceRequirementsFromMRF(applicationId);
  } catch (err: any) {
    console.error("[PostHire] Auto compliance generation error:", err.message);
  }

  return result;
};


