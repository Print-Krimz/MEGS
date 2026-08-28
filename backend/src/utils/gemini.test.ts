import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGenerateContent = vi.fn();

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: (...args: any[]) => mockGenerateContent(...args),
      },
    })),
  };
});

import { analyzeResume, extractResumeProfileData } from "./gemini.js";

describe("Gemini Resume Analysis Utility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "mock-key";
  });

  it("uses gemini-2.0-flash or configured GEMINI_MODEL and parses JSON response", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        score: 88,
        summary: "Excellent candidate with required expertise.",
        strengths: ["TypeScript", "Node.js", "PostgreSQL"],
        gaps: ["No GraphQL experience"],
      }),
    });

    const result = await analyzeResume(
      "5 years TypeScript backend engineer",
      "Senior Backend Engineer",
      "Node.js, TypeScript, PostgreSQL"
    );

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
      })
    );

    expect(result).toEqual({
      score: 88,
      summary: "Excellent candidate with required expertise.",
      strengths: ["TypeScript", "Node.js", "PostgreSQL"],
      gaps: ["No GraphQL experience"],
    });
  });

  it("strips markdown json fences if model wraps response", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: "```json\n" + JSON.stringify({
        score: 70,
        summary: "Good fit.",
        strengths: ["Communication"],
        gaps: [],
      }) + "\n```",
    });

    const result = await analyzeResume("Resume text", "Manager", "Leadership");

    expect(result.score).toBe(70);
    expect(result.summary).toBe("Good fit.");
  });

  describe("extractResumeProfileData", () => {
    it("successfully extracts comprehensive profile data including demographics, physical stats, and character references", async () => {
      const mockExtracted = {
        firstName: "Juan",
        middleName: "Dela",
        lastName: "Cruz",
        email: "juan.delacruz@example.com",
        mobileNumber: "09171234567",
        dateOfBirth: "1995-08-15",
        birthPlace: "Calamba City, Laguna",
        gender: "Male",
        nationality: "Filipino",
        civilStatus: "Single",
        religion: "Roman Catholic",
        height: 172,
        weight: 68,
        address: "123 Mabini St",
        city: "Calamba",
        province: "Laguna",
        preferredWorkLocations: "Makati, Taguig, Calamba",
        professionalSummary: "Experienced logistics specialist with 5 years in supply chain.",
        skills: ["Inventory Management", "Forklift Operation", "SAP ERP", "MS Excel"],
        educations: [
          {
            school: "Laguna State Polytechnic University",
            degree: "Bachelor of Science",
            fieldOfStudy: "Industrial Technology",
            startDate: "2015-06-01",
            endDate: "2019-04-15",
            notes: "Graduated with honors",
          },
        ],
        workExperiences: [
          {
            company: "ABC Logistics Inc.",
            roleTitle: "Warehouse Supervisor",
            location: "Calamba, Laguna",
            startDate: "2021-01-15",
            endDate: null,
            isCurrent: true,
            summary: "Supervised 15 warehouse staff and managed stock inventory.",
          },
        ],
        trainings: [
          {
            title: "TESDA NC II Forklift Driving",
            provider: "TESDA Calamba",
            completionDate: "2020-08-20",
            certificateNo: "CERT-2020-8812",
          },
        ],
        characterReferences: [
          {
            name: "Engr. Roberto Gomez",
            relationship: "Former Operations Manager",
            company: "ABC Logistics Inc.",
            phone: "09181234567",
            email: "r.gomez@abclogistics.com",
            notes: "Direct supervisor for 3 years",
          },
          {
            name: "Prof. Elena Ramos",
            relationship: "Department Chair",
            company: "Laguna State Polytechnic University",
            phone: "09229876543",
            email: "elena.ramos@lspu.edu.ph",
          },
        ],
      };

      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify(mockExtracted),
      });

      const result = await extractResumeProfileData("Juan Dela Cruz resume content...");

      expect(result.firstName).toBe("Juan");
      expect(result.lastName).toBe("Cruz");
      expect(result.mobileNumber).toBe("09171234567");
      expect(result.dateOfBirth).toBe("1995-08-15");
      expect(result.birthPlace).toBe("Calamba City, Laguna");
      expect(result.gender).toBe("Male");
      expect(result.nationality).toBe("Filipino");
      expect(result.civilStatus).toBe("Single");
      expect(result.religion).toBe("Roman Catholic");
      expect(result.height).toBe(172);
      expect(result.weight).toBe(68);
      expect(result.skills).toEqual(["Inventory Management", "Forklift Operation", "SAP ERP", "MS Excel"]);
      expect(result.workExperiences).toHaveLength(1);
      expect(result.workExperiences?.[0]?.company).toBe("ABC Logistics Inc.");
      expect(result.workExperiences?.[0]?.isCurrent).toBe(true);
      expect(result.educations).toHaveLength(1);
      expect(result.educations?.[0]?.school).toBe("Laguna State Polytechnic University");
      expect(result.trainings).toHaveLength(1);
      expect(result.trainings?.[0]?.title).toBe("TESDA NC II Forklift Driving");
      expect(result.characterReferences).toHaveLength(2);
      expect(result.characterReferences?.[0]?.name).toBe("Engr. Roberto Gomez");
      expect(result.characterReferences?.[0]?.relationship).toBe("Former Operations Manager");
      expect(result.characterReferences?.[0]?.phone).toBe("09181234567");
      expect(result.characterReferences?.[0]?.email).toBe("r.gomez@abclogistics.com");
      expect(result.characterReferences?.[1]?.name).toBe("Prof. Elena Ramos");
    });

    it("handles naming convention aliases like birth_date, placeOfBirth, string height/weight, and references array", async () => {
      const mockRawOutput = {
        first_name: "Ana",
        last_name: "Reyes",
        birth_date: "1998-12-04",
        placeOfBirth: "Batangas City",
        sex: "Female",
        citizenship: "Filipino",
        marital_status: "Single",
        religion: "Iglesia ni Cristo",
        height: "165 cm",
        weight: "55 kg",
        references: [
          {
            full_name: "Dr. Carlos Perez",
            position: "General Manager",
            organization: "Perez Holdings",
            contact_number: "09191234567",
            email: "cperez@perezhld.com",
          },
        ],
      };

      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify(mockRawOutput),
      });

      const result = await extractResumeProfileData("Ana Reyes resume content with aliases...");

      expect(result.firstName).toBe("Ana");
      expect(result.lastName).toBe("Reyes");
      expect(result.dateOfBirth).toBe("1998-12-04");
      expect(result.birthPlace).toBe("Batangas City");
      expect(result.gender).toBe("Female");
      expect(result.nationality).toBe("Filipino");
      expect(result.civilStatus).toBe("Single");
      expect(result.religion).toBe("Iglesia ni Cristo");
      expect(result.height).toBe(165);
      expect(result.weight).toBe(55);
      expect(result.characterReferences).toHaveLength(1);
      expect(result.characterReferences?.[0]?.name).toBe("Dr. Carlos Perez");
      expect(result.characterReferences?.[0]?.phone).toBe("09191234567");
    });

    it("handles minimal resume text without crashing or inventing fields", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          firstName: "Maria",
          lastName: "Santos",
          skills: ["Customer Service"],
        }),
      });

      const result = await extractResumeProfileData("Maria Santos - Customer Service");

      expect(result.firstName).toBe("Maria");
      expect(result.lastName).toBe("Santos");
      expect(result.middleName).toBeUndefined();
      expect(result.mobileNumber).toBeUndefined();
      expect(result.dateOfBirth).toBeUndefined();
      expect(result.birthPlace).toBeUndefined();
      expect(result.gender).toBeUndefined();
      expect(result.nationality).toBeUndefined();
      expect(result.religion).toBeUndefined();
      expect(result.height).toBeUndefined();
      expect(result.weight).toBeUndefined();
      expect(result.skills).toEqual(["Customer Service"]);
      expect(result.educations).toEqual([]);
      expect(result.workExperiences).toEqual([]);
      expect(result.trainings).toEqual([]);
      expect(result.characterReferences).toEqual([]);
    });

    it("throws a descriptive error when Gemini response is empty or invalid JSON", async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: "" });

      await expect(extractResumeProfileData("some text")).rejects.toThrow("Gemini returned an empty response");
    });
  });
});

