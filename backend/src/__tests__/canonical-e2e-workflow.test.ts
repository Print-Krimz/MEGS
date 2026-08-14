import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../utils/prisma.js";
import { updateTAApplicationStatus } from "../services/ta/ta.applications.service.js";
import { recordClientEndorsement, listClientEndorsements } from "../services/ta/ta.endorsement.service.js";
import { addMRFComplianceTemplate, listMRFComplianceTemplates } from "../services/ta/ta.mrf.service.js";
import {
  createComplianceRequirement,
  submitDocumentForRequirement,
  reviewComplianceRequirement,
  isFullyCompliant,
} from "../services/ta/ta.compliance.service.js";
import { executeHiring } from "../services/ta/ta.posthire.service.js";
import { createDeployment } from "../services/ta/ta.deployments.service.js";

describe("MEGS End-to-End Canonical Recruitment Pipeline", () => {
  let taUser: any;
  let applicantUser: any;
  let client: any;
  let mrf: any;
  let jobPosting: any;
  let application: any;

  beforeAll(async () => {
    // 1. Create TA User
    taUser = await prisma.user.create({
      data: {
        id: `ta-e2e-${Date.now()}`,
        email: `ta-e2e-${Date.now()}@example.com`,
        role: "TALENT_ACQUISITION",
      },
    });

    // 2. Create Applicant User with complete profile
    applicantUser = await prisma.user.create({
      data: {
        id: `applicant-e2e-${Date.now()}`,
        email: `applicant-e2e-${Date.now()}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Alex",
            lastName: "Reyes",
            mobileNumber: "09991234567",
            gender: "MALE",
            province: "Metro Manila",
            city: "Makati",
            dateOfBirth: new Date("1992-05-15"),
            birthPlace: "Makati City",
            nationality: "Filipino",
            civilStatus: "SINGLE",
            address: "456 Ayala Ave",
            professionalSummary: "Full Stack Engineer with 6 years experience in Node.js and PostgreSQL",
          },
        },
      },
    });

    // 3. Create Client
    client = await prisma.client.create({
      data: {
        name: `Acme Corp ${Date.now()}`,
        industry: "Financial Services",
        contactName: "John Doe",
        contactEmail: "johndoe@acme.com",
      },
    });

    // 4. Create MRF with structured requirements (Priority 4)
    mrf = await prisma.manpowerRequest.create({
      data: {
        clientId: client.id,
        createdById: taUser.id,
        title: "Senior Full Stack Engineer",
        description: "Leading frontend and backend development",
        headcount: 3,
        location: "Makati City",
        priority: "HIGH",
        requiredSkills: "TypeScript, React, Node.js, PostgreSQL",
        requiredExperience: "5+ years",
        requiredEducation: "BS Computer Science or related",
        requiredCertifications: "AWS Certified Developer",
        salaryRangeMin: 120000,
        salaryRangeMax: 180000,
        employmentType: "FULL_TIME",
        workArrangement: "HYBRID",
        complianceRequirements: JSON.stringify([
          { label: "NBI Clearance", isRequired: true },
          { label: "Fit to Work Medical Exam", isRequired: true },
          { label: "SSS Document", isRequired: true },
        ]),
      },
    });

    // Add compliance template to MRF
    await addMRFComplianceTemplate(mrf.id, "Client NDA & Security Briefing", true);

    // 5. Create Job Posting linked to MRF
    jobPosting = await prisma.jobPosting.create({
      data: {
        postedById: taUser.id,
        mrfId: mrf.id,
        title: "Senior Full Stack Engineer",
        description: "Leading frontend and backend development",
        requirements: "TypeScript, React, Node.js, PostgreSQL",
        status: "OPEN",
      },
    });
  });

  afterAll(async () => {
    // Teardown
    if (application?.id) {
      await prisma.deploymentStatusHistory.deleteMany({
        where: { deployment: { applicationId: application.id } },
      });
      await prisma.deployment.deleteMany({ where: { applicationId: application.id } });
      await prisma.employmentEvent.deleteMany({
        where: { employee: { originatingApplicationId: application.id } },
      });
      await prisma.employee.deleteMany({ where: { originatingApplicationId: application.id } });
      await prisma.complianceRequirement.deleteMany({ where: { applicationId: application.id } });
      await prisma.clientEndorsement.deleteMany({ where: { applicationId: application.id } });
      await prisma.interview.deleteMany({ where: { applicationId: application.id } });
      await prisma.recruiterDecision.deleteMany({ where: { applicationId: application.id } });
      await prisma.application.deleteMany({ where: { id: application.id } });
    }
    if (jobPosting?.id) await prisma.jobPosting.deleteMany({ where: { id: jobPosting.id } });
    if (mrf?.id) {
      if ((prisma as any).mRFComplianceTemplate) {
        await (prisma as any).mRFComplianceTemplate.deleteMany({ where: { mrfId: mrf.id } });
      } else if ((prisma as any).mrfComplianceTemplate) {
        await (prisma as any).mrfComplianceTemplate.deleteMany({ where: { mrfId: mrf.id } });
      }
      await prisma.manpowerRequest.deleteMany({ where: { id: mrf.id } });
    }
    if (client?.id) await prisma.client.deleteMany({ where: { id: client.id } });
    if (applicantUser?.id) {
      await prisma.talentPoolMembership.deleteMany({
        where: { applicantProfile: { userId: applicantUser.id } },
      });
      await prisma.notification.deleteMany({ where: { userId: applicantUser.id } });
      await prisma.applicantProfile.deleteMany({ where: { userId: applicantUser.id } });
      await prisma.user.deleteMany({ where: { id: applicantUser.id } });
    }
    if (taUser?.id) {
      await prisma.notification.deleteMany({ where: { userId: taUser.id } });
      await prisma.user.deleteMany({ where: { id: taUser.id } });
    }
  });

  it("Stage 1: Application Submission & Worker Ingestion (SUBMITTED → PARSING → REVIEW)", async () => {
    application = await prisma.application.create({
      data: {
        userId: applicantUser.id,
        jobPostingId: jobPosting.id,
        status: "SUBMITTED",
        resumeUrl: "https://example.com/resumes/alex-reyes.pdf",
      },
    });
    expect(application.status).toBe("SUBMITTED");

    // Advance to PARSING
    const parsingApp = await updateTAApplicationStatus(
      application.id,
      "PARSING",
      undefined,
      "Worker started PDF ingestion"
    );
    expect(parsingApp.status).toBe("PARSING");

    // Advance to REVIEW (Gemini scoring simulation)
    const reviewApp = await updateTAApplicationStatus(
      application.id,
      "REVIEW",
      undefined,
      "AI resume match completed: 92/100"
    );
    expect(reviewApp.status).toBe("REVIEW");
  });

  it("Stage 2: Initial Screening Interview Gating (REVIEW → INITIAL_SCREENING → CLIENT_ENDORSEMENT)", async () => {
    // Move to INITIAL_SCREENING
    const screeningApp = await updateTAApplicationStatus(
      application.id,
      "INITIAL_SCREENING",
      taUser.id,
      "Applicant passed preliminary AI resume filter"
    );
    expect(screeningApp.status).toBe("INITIAL_SCREENING");

    // Attempting to endorse candidate before interview fails
    await expect(
      updateTAApplicationStatus(application.id, "CLIENT_ENDORSEMENT", taUser.id)
    ).rejects.toThrow(/A passed INITIAL_SCREENING interview is required/);

    // Schedule and conduct screening interview with PASS result
    const interview = await prisma.interview.create({
      data: {
        applicationId: application.id,
        type: "INITIAL_SCREENING",
        result: "PASS",
        scheduledAt: new Date(),
        conductedAt: new Date(),
        notes: "Solid fundamentals, clear communication",
      },
    });
    expect(interview.result).toBe("PASS");

    // Now transition to CLIENT_ENDORSEMENT succeeds
    const endorsedStageApp = await updateTAApplicationStatus(
      application.id,
      "CLIENT_ENDORSEMENT",
      taUser.id,
      "Screening interview passed successfully"
    );
    expect(endorsedStageApp.status).toBe("CLIENT_ENDORSEMENT");
  });

  it("Stage 3: Client Endorsement Evaluation & Gating (CLIENT_ENDORSEMENT → FINAL_INTERVIEW)", async () => {
    // Attempting to move to FINAL_INTERVIEW without endorsement fails
    await expect(
      updateTAApplicationStatus(application.id, "FINAL_INTERVIEW", taUser.id)
    ).rejects.toThrow(/Client endorsement.*required/);

    // Record Client Endorsement (Priority 3)
    const endorsement = await recordClientEndorsement(
      application.id,
      client.id,
      "ENDORSED",
      taUser.id,
      "Client reviewed candidate portfolio and approved for final round"
    );
    expect(endorsement.outcome).toBe("ENDORSED");

    const endorsements = await listClientEndorsements(application.id);
    expect(endorsements.length).toBe(1);

    // Transition to FINAL_INTERVIEW now succeeds
    const finalStageApp = await updateTAApplicationStatus(
      application.id,
      "FINAL_INTERVIEW",
      taUser.id,
      "Client endorsement received"
    );
    expect(finalStageApp.status).toBe("FINAL_INTERVIEW");
  });

  it("Stage 4: Final Interview & Hiring (FINAL_INTERVIEW → HIRED)", async () => {
    // Cannot hire without passing final interview
    await expect(
      updateTAApplicationStatus(application.id, "HIRED", taUser.id)
    ).rejects.toThrow(/A passed FINAL_INTERVIEW is required/);

    // Conduct final interview
    await prisma.interview.create({
      data: {
        applicationId: application.id,
        type: "FINAL_INTERVIEW",
        result: "PASS",
        scheduledAt: new Date(),
        conductedAt: new Date(),
        notes: "Technical architecture evaluation passed with distinction",
      },
    });

    // Execute atomic hiring
    const hiringResult = await executeHiring(
      application.id,
      {
        employeeNumber: `EMP-${Date.now()}`,
        department: "Engineering",
        position: "Senior Full Stack Engineer",
        startDate: new Date(),
        reason: "Job offer accepted and signed",
      },
      taUser.id
    );

    expect(hiringResult.application.status).toBe("HIRED");
    expect(hiringResult.employee).toBeDefined();
    expect(hiringResult.employee.userId).toBe(applicantUser.id);
  });

  it("Stage 5: Compliance Generation & Pre-employment Verification (HIRED → COMPLIANCE)", async () => {
    // Advance to COMPLIANCE
    const complianceApp = await updateTAApplicationStatus(
      application.id,
      "COMPLIANCE",
      taUser.id,
      "Candidate entering compliance document collection"
    );
    expect(complianceApp.status).toBe("COMPLIANCE");

    // Verify compliance checklist items were auto-generated from MRF templates
    const requirements = await prisma.complianceRequirement.findMany({
      where: { applicationId: application.id },
    });
    expect(requirements.length).toBeGreaterThanOrEqual(1);

    // Deployment must be rejected when requirements are unapproved
    await expect(
      updateTAApplicationStatus(application.id, "DEPLOYED", taUser.id)
    ).rejects.toThrow(/compliance/i);

    // Approve all requirements with valid expiration dates
    const futureExpiry = new Date();
    futureExpiry.setDate(futureExpiry.getDate() + 180);

    for (const req of requirements) {
      await reviewComplianceRequirement(
        req.id,
        taUser.id,
        "APPROVED",
        "Document verified valid and unexpired",
        futureExpiry
      );
    }

    const fullyCompliant = await isFullyCompliant(application.id);
    expect(fullyCompliant).toBe(true);
  });

  it("Stage 6: Deployment Lifecycle (COMPLIANCE → DEPLOYED)", async () => {
    const deployment = await createDeployment(taUser.id, {
      applicationId: application.id,
      clientId: client.id,
      mrfId: mrf.id,
      site: "Client HQ, Makati",
      notes: "Candidate deployed successfully to project team",
    });

    expect(deployment).toBeDefined();
    expect(deployment.status).toBe("PENDING_ORIENTATION");

    // Verify application status is now DEPLOYED
    const updatedApp = await prisma.application.findUnique({
      where: { id: application.id },
    });
    expect(updatedApp?.status).toBe("DEPLOYED");
  });

  it("Stage 7: Full Recruiter Decision Audit Trail Verification", async () => {
    const auditLogs = await prisma.recruiterDecision.findMany({
      where: { applicationId: application.id },
      orderBy: { createdAt: "asc" },
    });

    const transitions = auditLogs.map((log) => `${log.fromStatus} -> ${log.toStatus}`);
    expect(transitions).toContain("SUBMITTED -> PARSING");
    expect(transitions).toContain("PARSING -> REVIEW");
    expect(transitions).toContain("REVIEW -> INITIAL_SCREENING");
    expect(transitions).toContain("INITIAL_SCREENING -> CLIENT_ENDORSEMENT");
    expect(transitions).toContain("CLIENT_ENDORSEMENT -> FINAL_INTERVIEW");
    expect(transitions).toContain("FINAL_INTERVIEW -> HIRED");
    expect(transitions).toContain("HIRED -> COMPLIANCE");
    expect(transitions).toContain("COMPLIANCE -> DEPLOYED");
  });
});
