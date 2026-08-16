import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../utils/prisma.js";
import { createComplianceRequirement, reviewComplianceRequirement } from "../services/ta/ta.compliance.service.js";
import { uploadApplicantComplianceDocument } from "../services/applicant/application.service.js";

describe("Phase 3: Applicant Compliance Upload & Review Flow", () => {
  let testTA: any;
  let testUser: any;
  let testClient: any;
  let testMrf: any;
  let testJob: any;
  let testApp: any;
  let testReq: any;

  beforeAll(async () => {
    testTA = await prisma.user.create({
      data: {
        id: `ta-p3-${Date.now()}`,
        email: `ta-p3-${Date.now()}@example.com`,
        role: "TALENT_ACQUISITION",
      },
    });

    testUser = await prisma.user.create({
      data: {
        id: `cand-p3-${Date.now()}`,
        email: `cand-p3-${Date.now()}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Compliance",
            lastName: "Candidate",
            mobileNumber: "09333333333",
          },
        },
      },
    });

    testClient = await prisma.client.create({
      data: {
        name: `Compliance Corp ${Date.now()}`,
      },
    });

    testMrf = await prisma.manpowerRequest.create({
      data: {
        clientId: testClient.id,
        createdById: testTA.id,
        title: "Compliance Specialist",
      },
    });

    testJob = await prisma.jobPosting.create({
      data: {
        postedById: testTA.id,
        mrfId: testMrf.id,
        title: "Compliance Specialist",
        description: "Specialist description",
        requirements: "Clearance, Medical",
        status: "OPEN",
      },
    });

    testApp = await prisma.application.create({
      data: {
        userId: testUser.id,
        jobPostingId: testJob.id,
        status: "COMPLIANCE",
      },
    });

    testReq = await createComplianceRequirement(
      testApp.id,
      "NBI Clearance",
      true
    );
  });

  afterAll(async () => {
    try {
      if (testApp?.id) {
        await prisma.complianceRequirement.deleteMany({ where: { applicationId: testApp.id } });
        await prisma.storedDocument.deleteMany({ where: { applicationId: testApp.id } });
        await prisma.application.deleteMany({ where: { id: testApp.id } });
      }
      if (testJob?.id) await prisma.jobPosting.deleteMany({ where: { id: testJob.id } });
      if (testMrf?.id) await prisma.manpowerRequest.deleteMany({ where: { id: testMrf.id } });
      if (testClient?.id) await prisma.client.deleteMany({ where: { id: testClient.id } });
      if (testUser?.id) {
        await prisma.notification.deleteMany({ where: { userId: testUser.id } });
        await prisma.applicantProfile.deleteMany({ where: { userId: testUser.id } });
        await prisma.user.deleteMany({ where: { id: testUser.id } });
      }
      if (testTA?.id) {
        await prisma.notification.deleteMany({ where: { userId: testTA.id } });
        await prisma.user.deleteMany({ where: { id: testTA.id } });
      }
    } catch {
      // Best-effort cleanup
    }
  });

  it("allows applicant to upload document and transitions requirement to SUBMITTED", async () => {
    const mockFile: Express.Multer.File = {
      fieldname: "file",
      originalname: "nbi-clearance-2026.pdf",
      encoding: "7bit",
      mimetype: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 Mock PDF Content for Testing"),
      size: 38,
      destination: "",
      filename: "",
      path: "",
      stream: null as any,
    };

    const result = await uploadApplicantComplianceDocument(
      testUser.id,
      testReq.id,
      mockFile
    );

    expect(result.reviewStatus).toBe("SUBMITTED");
    expect(result.documentId).toBeDefined();

    // Verify stored document exists
    const storedDoc = await prisma.storedDocument.findUnique({
      where: { id: result.documentId! },
    });
    expect(storedDoc).toBeDefined();
    expect(storedDoc?.originalName).toBe("nbi-clearance-2026.pdf");
    expect(storedDoc?.ownerId).toBe(testUser.id);
  });

  it("records rejection reason when TA reviews document as REJECTED", async () => {
    const reviewed = await reviewComplianceRequirement(
      testReq.id,
      testTA.id,
      "REJECTED",
      "Expired stamp on document. Please upload latest clearance."
    );

    expect(reviewed.reviewStatus).toBe("REJECTED");
    expect(reviewed.reviewNotes).toContain("Expired stamp on document");
  });
});
