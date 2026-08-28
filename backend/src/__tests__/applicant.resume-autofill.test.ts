import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    applicantProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    workExperience: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    education: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    applicantSkill: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    skill: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    trainingCertification: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    characterReference: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  supabase: {
    storage: {
      from: vi.fn(),
      listBuckets: vi.fn(),
    },
  },
  extractResumeProfileData: vi.fn(),
  pdfParse: vi.fn(),
  revalidateApplicantProfile: vi.fn(),
  uploadFileToSupabase: vi.fn(),
}));

vi.mock("../utils/prisma.js", () => ({ default: mocks.prisma }));
vi.mock("../utils/supabase.js", () => ({ default: mocks.supabase }));
vi.mock("../utils/gemini.js", () => ({
  extractResumeProfileData: mocks.extractResumeProfileData,
}));
vi.mock("pdf-parse/lib/pdf-parse.js", () => ({ default: mocks.pdfParse }));
vi.mock("../services/scoring/scoring-configuration.service.js", () => ({
  revalidateApplicantProfile: mocks.revalidateApplicantProfile,
}));
vi.mock("../middleware/upload.middleware.js", () => ({
  uploadFileToSupabase: mocks.uploadFileToSupabase,
}));

import {
  processResumeExtractionService,
  applyExtractedProfileService,
} from "../services/applicant/applicant.service.js";

describe("Resume Auto-Fill Service & Extraction Pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("processResumeExtractionService", () => {
    it("parses PDF buffer, calls Gemini extraction, and returns structured data with SUCCESS status", async () => {
      const mockPdfBuffer = Buffer.from("pdf-data");
      mocks.pdfParse.mockResolvedValueOnce({
        text: "Juan Dela Cruz\nSoftware Engineer\nLaguna State Polytechnic University",
      });

      mocks.extractResumeProfileData.mockResolvedValueOnce({
        firstName: "Juan",
        lastName: "Dela Cruz",
        mobileNumber: "09171234567",
        province: "Laguna",
        city: "Calamba",
        skills: ["TypeScript", "Node.js"],
        educations: [
          {
            school: "Laguna State Polytechnic University",
            degree: "BS Industrial Technology",
          },
        ],
        workExperiences: [
          {
            company: "ABC Corp",
            roleTitle: "Software Developer",
          },
        ],
      });

      const result = await processResumeExtractionService(mockPdfBuffer);

      expect(mocks.pdfParse).toHaveBeenCalledWith(mockPdfBuffer);
      expect(mocks.extractResumeProfileData).toHaveBeenCalled();
      expect(result.extractionStatus).toBe("SUCCESS");
      expect(result.extractedData?.firstName).toBe("Juan");
      expect(result.extractedData?.skills).toEqual(["TypeScript", "Node.js"]);
    });

    it("handles empty or image-only PDF text gracefully with UNAVAILABLE status", async () => {
      const mockPdfBuffer = Buffer.from("scanned-pdf-data");
      mocks.pdfParse.mockResolvedValueOnce({
        text: "   \n\t  ",
      });

      const result = await processResumeExtractionService(mockPdfBuffer);

      expect(mocks.extractResumeProfileData).not.toHaveBeenCalled();
      expect(result.extractionStatus).toBe("UNAVAILABLE");
      expect(result.extractedData).toBeNull();
    });

    it("handles Gemini extraction failure gracefully without throwing", async () => {
      const mockPdfBuffer = Buffer.from("corrupt-pdf-data");
      mocks.pdfParse.mockResolvedValueOnce({
        text: "Valid text",
      });
      mocks.extractResumeProfileData.mockRejectedValueOnce(
        new Error("Gemini quota exceeded or network timeout")
      );

      const result = await processResumeExtractionService(mockPdfBuffer);

      expect(result.extractionStatus).toBe("UNAVAILABLE");
      expect(result.extractedData).toBeNull();
    });
  });

  describe("applyExtractedProfileService", () => {
    it("updates empty personal fields and deduplicates work experience, education, skills, and trainings", async () => {
      const userId = "u-applicant-1";

      mocks.prisma.applicantProfile.findUnique.mockResolvedValueOnce({
        id: 42,
        userId,
        firstName: "Maria",
        lastName: "Santos",
        mobileNumber: null, // empty
        address: null, // empty
        city: null, // empty
        province: null, // empty
        professionalSummary: "Existing user summary", // already has content
      });

      // Existing relations
      mocks.prisma.workExperience.findMany.mockResolvedValueOnce([
        {
          id: 1,
          applicantProfileId: 42,
          company: "Existing Company",
          roleTitle: "Junior Dev",
        },
      ]);
      mocks.prisma.education.findMany.mockResolvedValueOnce([
        {
          id: 1,
          applicantProfileId: 42,
          school: "Existing University",
          degree: "BS IT",
        },
      ]);
      mocks.prisma.applicantSkill.findMany.mockResolvedValueOnce([
        {
          applicantProfileId: 42,
          skillId: 10,
          skill: { id: 10, name: "javascript" },
        },
      ]);
      mocks.prisma.trainingCertification.findMany.mockResolvedValueOnce([
        {
          id: 1,
          applicantProfileId: 42,
          title: "Existing Safety Training",
        },
      ]);

      mocks.prisma.applicantProfile.update.mockResolvedValueOnce({
        id: 42,
        userId,
        firstName: "Maria",
        lastName: "Santos",
        mobileNumber: "09181234567",
        city: "Cabuyao",
        province: "Laguna",
        professionalSummary: "Existing user summary",
      });

      // Transaction mock implementation
      mocks.prisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mocks.prisma);
      });

      mocks.prisma.skill.findUnique.mockResolvedValue(null);
      mocks.prisma.skill.create.mockResolvedValue({ id: 11, name: "typescript" });

      const extractedPayload = {
        personalDetails: {
          mobileNumber: "09181234567",
          city: "Cabuyao",
          province: "Laguna",
          professionalSummary: "New summary from resume",
        },
        overwriteExistingPersonal: false, // Do NOT overwrite existing professionalSummary
        workExperiences: [
          {
            company: "Existing Company", // duplicate
            roleTitle: "Junior Dev",
            startDate: "2020-01-01",
          },
          {
            company: "New Tech Corp", // new
            roleTitle: "Senior Dev",
            startDate: "2022-01-01",
          },
        ],
        educations: [
          {
            school: "Existing University", // duplicate
            degree: "BS IT",
          },
          {
            school: "New Masteral Institute", // new
            degree: "MS Computer Science",
          },
        ],
        skills: ["JavaScript", "TypeScript"], // JavaScript duplicate, TypeScript new
        trainings: [
          {
            title: "Existing Safety Training", // duplicate
          },
          {
            title: "AWS Certified Developer", // new
            provider: "Amazon",
          },
        ],
      };

      await applyExtractedProfileService(userId, extractedPayload);

      // Verify personal details update preserved existing summary because overwriteExistingPersonal is false
      expect(mocks.prisma.applicantProfile.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: expect.objectContaining({
          mobileNumber: "09181234567",
          city: "Cabuyao",
          province: "Laguna",
        }),
      });
      // Existing non-empty summary was not overwritten
      const updateCall = mocks.prisma.applicantProfile.update.mock.calls[0][0];
      expect(updateCall.data.professionalSummary).toBeUndefined();

      // Verify work experience deduplication: only 1 new experience created
      expect(mocks.prisma.workExperience.create).toHaveBeenCalledTimes(1);
      expect(mocks.prisma.workExperience.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          company: "New Tech Corp",
          roleTitle: "Senior Dev",
        }),
      });

      // Verify education deduplication: only 1 new education created
      expect(mocks.prisma.education.create).toHaveBeenCalledTimes(1);
      expect(mocks.prisma.education.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          school: "New Masteral Institute",
          degree: "MS Computer Science",
        }),
      });

      // Verify skills deduplication: only TypeScript added
      expect(mocks.prisma.applicantSkill.create).toHaveBeenCalledTimes(1);
      expect(mocks.prisma.applicantSkill.create).toHaveBeenCalledWith({
        data: {
          applicantProfileId: 42,
          skillId: 11,
        },
      });

      // Verify training deduplication: only AWS training added
      expect(mocks.prisma.trainingCertification.create).toHaveBeenCalledTimes(1);
      expect(mocks.prisma.trainingCertification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: "AWS Certified Developer",
        }),
      });
    });

    it("auto-fills dateOfBirth, birthPlace, gender, nationality, civilStatus, religion, height, weight, and multiple character references", async () => {
      const userId = "u-applicant-2";

      mocks.prisma.applicantProfile.findUnique.mockResolvedValueOnce({
        id: 77,
        userId,
        firstName: "Carlos",
        lastName: "Mendoza",
        gender: null,
        dateOfBirth: null,
        birthPlace: null,
        nationality: null,
        civilStatus: null,
        religion: null,
        height: null,
        weight: null,
      });

      mocks.prisma.workExperience.findMany.mockResolvedValueOnce([]);
      mocks.prisma.education.findMany.mockResolvedValueOnce([]);
      mocks.prisma.applicantSkill.findMany.mockResolvedValueOnce([]);
      mocks.prisma.trainingCertification.findMany.mockResolvedValueOnce([]);
      mocks.prisma.characterReference.findMany.mockResolvedValueOnce([
        {
          id: 1,
          applicantProfileId: 77,
          name: "Existing Reference",
          phone: "09111111111",
        },
      ]);

      mocks.prisma.applicantProfile.update.mockResolvedValueOnce({
        id: 77,
        userId,
        firstName: "Carlos",
        lastName: "Mendoza",
        gender: "Male",
        dateOfBirth: new Date("1996-05-20"),
        birthPlace: "Lipa City, Batangas",
        nationality: "Filipino",
        civilStatus: "Single",
        religion: "Roman Catholic",
        height: 175,
        weight: 70,
      });

      const extractedPayload = {
        personalDetails: {
          gender: "Male",
          dateOfBirth: "1996-05-20",
          birthPlace: "Lipa City, Batangas",
          nationality: "Filipino",
          civilStatus: "Single",
          religion: "Roman Catholic",
          height: 175,
          weight: 70,
        },
        characterReferences: [
          {
            name: "Existing Reference", // duplicate
            phone: "09111111111",
          },
          {
            name: "Engr. Marco Santos", // new
            relationship: "Production Manager",
            company: "Batangas Steel Corp",
            phone: "09172223333",
            email: "marco.santos@bsc.com",
            notes: "Direct supervisor for 4 years",
          },
          {
            name: "Dr. Alicia Lim", // new
            relationship: "Dean of Engineering",
            company: "Batangas State University",
            phone: "09183334444",
            email: "alicia.lim@bsu.edu.ph",
          },
        ],
      };

      await applyExtractedProfileService(userId, extractedPayload);

      expect(mocks.prisma.applicantProfile.update).toHaveBeenCalledWith({
        where: { id: 77 },
        data: expect.objectContaining({
          gender: "Male",
          dateOfBirth: expect.any(Date),
          birthPlace: "Lipa City, Batangas",
          nationality: "Filipino",
          civilStatus: "Single",
          religion: "Roman Catholic",
          height: 175,
          weight: 70,
        }),
      });

      // Verify character references deduplication: 2 new references added, 1 duplicate ignored
      expect(mocks.prisma.characterReference.create).toHaveBeenCalledTimes(2);
      expect(mocks.prisma.characterReference.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          applicantProfileId: 77,
          name: "Engr. Marco Santos",
          phone: "09172223333",
          email: "marco.santos@bsc.com",
        }),
      });
      expect(mocks.prisma.characterReference.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          applicantProfileId: 77,
          name: "Dr. Alicia Lim",
          phone: "09183334444",
          email: "alicia.lim@bsu.edu.ph",
        }),
      });
    });
  });

  describe("Applicant Controller: uploadResume & applyExtractedProfile", () => {
    it("uploadResume controller returns profile, resumeUrl, extractedData, and extractionStatus", async () => {
      const { uploadResume } = await import("../controllers/applicant/applicant.controller.js");

      mocks.prisma.applicantProfile.findUnique.mockResolvedValue({
        id: 42,
        userId: "u-app-1",
        firstName: "Maria",
        lastName: "Santos",
        skills: [],
        workExperiences: [],
        educations: [],
        trainings: [],
        assets: [],
        characterReferences: [],
      });
      mocks.uploadFileToSupabase.mockResolvedValueOnce("/api/documents/55/download");
      mocks.prisma.applicantProfile.upsert.mockResolvedValue({
        id: 42,
        userId: "u-app-1",
        firstName: "Maria",
        lastName: "Santos",
        resumeUrl: "/api/documents/55/download",
      });
      mocks.prisma.applicantProfile.update.mockResolvedValue({
        id: 42,
        userId: "u-app-1",
        resumeUrl: "/api/documents/55/download",
      });
      mocks.prisma.workExperience.findMany.mockResolvedValue([]);
      mocks.prisma.education.findMany.mockResolvedValue([]);
      mocks.prisma.applicantSkill.findMany.mockResolvedValue([]);
      mocks.prisma.trainingCertification.findMany.mockResolvedValue([]);
      mocks.prisma.characterReference.findMany.mockResolvedValue([]);

      mocks.pdfParse.mockResolvedValueOnce({ text: "Maria Santos\nWarehouse Supervisor" });
      mocks.extractResumeProfileData.mockResolvedValueOnce({
        firstName: "Maria",
        lastName: "Santos",
        dateOfBirth: "1997-03-12",
        birthPlace: "Quezon City",
        gender: "Female",
        nationality: "Filipino",
        civilStatus: "Single",
        religion: "Roman Catholic",
        height: 162,
        weight: 54,
        professionalSummary: "Warehouse Supervisor with 6 years experience",
        skills: ["Logistics", "SAP"],
        characterReferences: [
          {
            name: "Juan Reyes",
            relationship: "Former Supervisor",
            phone: "09171112222",
            email: "jreyes@example.com",
          },
        ],
      });

      const mockReq: any = {
        user: { id: "u-app-1", role: "APPLICANT" },
        file: {
          buffer: Buffer.from("dummy-pdf"),
          originalname: "resume.pdf",
          mimetype: "application/pdf",
          size: 1024,
        },
      };

      const mockRes: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      await uploadResume(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            resumeUrl: "/api/documents/55/download",
            extractionStatus: "SUCCESS",
            extractedData: expect.objectContaining({
              firstName: "Maria",
              dateOfBirth: "1997-03-12",
              birthPlace: "Quezon City",
              gender: "Female",
              nationality: "Filipino",
              civilStatus: "Single",
              religion: "Roman Catholic",
              height: 162,
              weight: 54,
              skills: ["Logistics", "SAP"],
              characterReferences: expect.arrayContaining([
                expect.objectContaining({ name: "Juan Reyes" }),
              ]),
            }),
          }),
        })
      );
      expect(mocks.prisma.characterReference.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Juan Reyes",
            phone: "09171112222",
          }),
        })
      );
    });

    it("uploadResume creates profile record seamlessly for brand new applicant without profile row", async () => {
      const { uploadResume } = await import("../controllers/applicant/applicant.controller.js");

      // First call (upsert create), then findUnique returns newly created profile
      mocks.prisma.applicantProfile.upsert.mockResolvedValueOnce({
        id: 99,
        userId: "u-brand-new",
        firstName: "",
        lastName: "",
        resumeUrl: "/api/documents/88/download",
      });

      mocks.prisma.applicantProfile.findUnique.mockResolvedValue({
        id: 99,
        userId: "u-brand-new",
        firstName: "Newbie",
        lastName: "Applicant",
        skills: [],
        workExperiences: [],
        educations: [],
        trainings: [],
        assets: [],
        characterReferences: [],
      });

      mocks.uploadFileToSupabase.mockResolvedValueOnce("/api/documents/88/download");
      mocks.prisma.workExperience.findMany.mockResolvedValue([]);
      mocks.prisma.education.findMany.mockResolvedValue([]);
      mocks.prisma.applicantSkill.findMany.mockResolvedValue([]);
      mocks.prisma.trainingCertification.findMany.mockResolvedValue([]);

      mocks.pdfParse.mockResolvedValueOnce({ text: "Newbie Applicant\nJunior Developer" });
      mocks.extractResumeProfileData.mockResolvedValueOnce({
        firstName: "Newbie",
        lastName: "Applicant",
        skills: ["JavaScript"],
      });

      const mockReq: any = {
        user: { id: "u-brand-new", role: "APPLICANT" },
        file: {
          buffer: Buffer.from("pdf-data"),
          originalname: "resume.pdf",
          mimetype: "application/pdf",
          size: 1024,
        },
      };

      const mockRes: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      await uploadResume(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            resumeUrl: "/api/documents/88/download",
            extractionStatus: "SUCCESS",
          }),
        })
      );
    });

    it("applyExtractedProfile controller saves details and returns updated profile", async () => {
      const { applyExtractedProfile } = await import("../controllers/applicant/applicant.controller.js");

      mocks.prisma.applicantProfile.findUnique.mockResolvedValue({
        id: 42,
        userId: "u-app-1",
        firstName: "Maria",
        lastName: "Santos",
        workExperiences: [],
        educations: [],
        skills: [],
        trainings: [],
        assets: [],
        characterReferences: [],
      });

      mocks.prisma.applicantProfile.update.mockResolvedValue({
        id: 42,
        userId: "u-app-1",
        firstName: "Maria",
        lastName: "Santos",
        mobileNumber: "09171234567",
      });

      mocks.prisma.workExperience.findMany.mockResolvedValue([]);
      mocks.prisma.education.findMany.mockResolvedValue([]);
      mocks.prisma.applicantSkill.findMany.mockResolvedValue([]);
      mocks.prisma.trainingCertification.findMany.mockResolvedValue([]);

      const mockReq: any = {
        user: { id: "u-app-1", role: "APPLICANT" },
        body: {
          personalDetails: {
            mobileNumber: "09171234567",
          },
          skills: ["Forklift"],
        },
      };

      const mockRes: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      await applyExtractedProfile(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("applied"),
        })
      );
    });
  });
});

