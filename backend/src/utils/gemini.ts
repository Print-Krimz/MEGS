import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

export const getGeminiClient = (): GoogleGenAI => {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY in environment variables");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

export interface ResumeAnalysisResult {
  score: number;       // 0–100 match score
  summary: string;
  strengths: string[];
  gaps: string[];
}

// Prompts Gemini for structured resume scoring. Invoked exclusively via background workers.
export const analyzeResume = async (
  resumeText: string,
  jobTitle: string,
  requirements: string
): Promise<ResumeAnalysisResult> => {
  const ai = getGeminiClient();

  const prompt = `
You are an expert HR analyst. Your task is to evaluate how well a candidate's resume matches a specific job opening.

JOB TITLE: ${jobTitle}

JOB REQUIREMENTS:
${requirements}

CANDIDATE RESUME:
${resumeText}

Analyze the resume against the job requirements and respond with a JSON object matching this exact structure:
{
  "score": <integer from 0 to 100 representing overall fit — 100 is a perfect match>,
  "summary": "<2 to 3 sentence overall assessment of the candidate's fit for this role>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "gaps": ["<gap 1>", "<gap 2>"]
}

Scoring guide:
- 80–100: Excellent match, meets nearly all requirements
- 60–79:  Good match, meets most requirements with minor gaps
- 40–59:  Partial match, meets some requirements
- 0–39:   Poor match, significant gaps

Be objective. Base your score only on the resume content vs the stated requirements.
Respond with valid JSON only. Do not include markdown or any text outside the JSON object.
`.trim();

  const modelName = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });
  let text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  // Strip markdown formatting if returned by model
  text = text.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();

  const parsed = JSON.parse(text) as ResumeAnalysisResult;

  if (
    typeof parsed.score !== "number" ||
    typeof parsed.summary !== "string" ||
    !Array.isArray(parsed.strengths) ||
    !Array.isArray(parsed.gaps)
  ) {
    throw new Error("Gemini returned an unexpected response structure");
  }

  parsed.score = Math.max(0, Math.min(100, parsed.score));

  return parsed;
};

export interface ExtractedProfileEducation {
  school: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface ExtractedProfileExperience {
  company: string;
  roleTitle: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  summary?: string;
}

export interface ExtractedProfileTraining {
  title: string;
  provider?: string;
  completionDate?: string;
  certificateNo?: string;
  notes?: string;
}

export interface ExtractedProfileReference {
  name: string;
  relationship?: string;
  company?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface ExtractedProfileData {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  mobileNumber?: string;
  dateOfBirth?: string;
  birthPlace?: string;
  gender?: string;
  nationality?: string;
  civilStatus?: string;
  religion?: string;
  height?: number;
  weight?: number;
  address?: string;
  city?: string;
  province?: string;
  preferredWorkLocations?: string;
  professionalSummary?: string;
  skills?: string[];
  educations?: ExtractedProfileEducation[];
  workExperiences?: ExtractedProfileExperience[];
  trainings?: ExtractedProfileTraining[];
  characterReferences?: ExtractedProfileReference[];
}

export {
  isAllUpper,
  normalizeTitleCase,
  normalizeSentenceCase,
  normalizeSkill,
} from "./text-case.js";
import {
  normalizeTitleCase,
  normalizeSentenceCase,
  normalizeSkill,
} from "./text-case.js";

const RESUME_EXTRACTION_SCHEMA = `
{
  "firstName": "<First Name or null if not found>",
  "middleName": "<Middle Name / Initial or null if not found>",
  "lastName": "<Last Name / Surname or null if not found>",
  "email": "<Email address or null if not found>",
  "mobileNumber": "<Mobile phone number e.g. 09171234567 or null if not found>",
  "dateOfBirth": "<Date of birth formatted as YYYY-MM-DD or null if not found>",
  "birthPlace": "<Place / municipality / province of birth or null if not found>",
  "gender": "<Gender / Sex e.g. Male, Female, Non-Binary, Prefer not to say or null if not found>",
  "nationality": "<Nationality / Citizenship e.g. Filipino or null if not found>",
  "civilStatus": "<Civil / Marital status e.g. Single, Married, Widowed, Separated, Divorced or null if not found>",
  "religion": "<Religion / Religious affiliation e.g. Roman Catholic, Christian, Islam, Iglesia ni Cristo or null if not found>",
  "height": <Height in cm as a number e.g. 170, or null if not found>,
  "weight": <Weight in kg as a number e.g. 65, or null if not found>,
  "address": "<Street / Residential Address or null if not found>",
  "city": "<City / Municipality e.g. Calamba, Makati, Quezon City or null if not found>",
  "province": "<Province / Region e.g. Laguna, Metro Manila, Batangas, Cebu or null if not found>",
  "preferredWorkLocations": "<Preferred work locations or null if not found>",
  "professionalSummary": "<Career objective, executive summary, or professional background statement from resume or null if not found>",
  "skills": ["<Skill 1>", "<Skill 2>"],
  "educations": [
    {
      "school": "<School or Institution Name>",
      "degree": "<Degree/Diploma e.g. Bachelor of Science, High School Diploma>",
      "fieldOfStudy": "<Field of study e.g. Computer Science, Business Admin or General>",
      "startDate": "<Start date in YYYY-MM-DD or YYYY-MM or YYYY format or null>",
      "endDate": "<End date in YYYY-MM-DD or YYYY-MM or YYYY format or null>",
      "notes": "<Honors, awards, or details or null>"
    }
  ],
  "workExperiences": [
    {
      "company": "<Company Name>",
      "roleTitle": "<Job Title / Role>",
      "location": "<Company Location or null>",
      "startDate": "<Start date in YYYY-MM-DD or YYYY-MM or YYYY format>",
      "endDate": "<End date in YYYY-MM-DD or YYYY-MM or YYYY format or null>",
      "isCurrent": <boolean true if current position or endDate is Present/Current, else false>,
      "summary": "<Key responsibilities and achievements summary or null>"
    }
  ],
  "trainings": [
    {
      "title": "<Training / Certification Title>",
      "provider": "<Issuing Organization or Provider or null>",
      "completionDate": "<Completion / Issue date in YYYY-MM-DD or YYYY-MM or YYYY format or null>",
      "certificateNo": "<Certificate ID / License No or null>",
      "notes": "<Additional notes or null>"
    }
  ],
  "characterReferences": [
    {
      "name": "<Reference Full Name>",
      "relationship": "<Relationship or Position / Role e.g. Operations Manager or Former Supervisor or null>",
      "company": "<Company or Organization name or null>",
      "phone": "<Contact phone number or null>",
      "email": "<Email address or null>",
      "notes": "<Additional notes or null>"
    }
  ]
}

STRICT EXTRACTION RULES:
1. ONLY extract information that is explicitly stated in the resume text or document.
2. Do NOT fabricate, invent, or guess missing information. If a field is not present in the resume, set its value to null (or omit).
3. Extract skills as a clean list of individual competencies, tools, frameworks, and domain expertise.
4. For names, properly identify First Name, Middle Name (if any), and Last Name.
5. If multiple character references are listed in the resume, extract all of them into the characterReferences array.
6. Casing Normalization: Format all names (firstName, middleName, lastName), locations (city, province, birthPlace, address), schools, degrees, fields of study, companies, role titles, certifications, civil status, nationality, religion, and character references in standard Title Case (e.g., "Adrian", "Miguel", "Reyes", "Quezon City", "Metro Manila", "Filipino", "Single", "Roman Catholic", "Bachelor of Science in Computer Science"), even if the source resume writes them in ALL CAPS. Normalize professionalSummary and experience summaries to standard natural sentence case. Preserve standard uppercase acronyms and abbreviations (e.g., "IT", "HR", "QA", "PHP", "AWS", "SQL", "UI/UX", "API", "BS", "MS", "PhD", "TESDA", "NC II", "Jr.", "Sr."). Do NOT output applicant profile values in ALL CAPITAL LETTERS.
7. Respond with valid JSON only. Do not include markdown fences or any text outside the JSON object.
`.trim();

export const parseGeminiJsonResponse = (text: string): any => {
  if (!text || !text.trim()) {
    throw new Error("Gemini returned an empty response");
  }
  const stripped = text.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error(`Failed to parse Gemini response as JSON: ${text.substring(0, 200)}`);
  }
};

export const mapParsedProfileData = (parsed: any): ExtractedProfileData => {
  const cleanString = (val: any): string | undefined => {
    if (val === undefined || val === null) return undefined;
    const str = String(val).trim();
    if (!str || str.toLowerCase() === "null" || str.toLowerCase() === "n/a" || str.toLowerCase() === "undefined") {
      return undefined;
    }
    return str;
  };

  const cleanTitleString = (val: any): string | undefined => {
    const str = cleanString(val);
    return str ? normalizeTitleCase(str) : undefined;
  };

  const cleanSentenceString = (val: any): string | undefined => {
    const str = cleanString(val);
    return str ? normalizeSentenceCase(str) : undefined;
  };

  const cleanNumber = (val: any): number | undefined => {
    if (val === undefined || val === null) return undefined;
    if (typeof val === "number" && !isNaN(val)) return val > 0 ? val : undefined;
    if (typeof val === "string") {
      const match = val.match(/[\d.]+/);
      if (match) {
        const num = parseFloat(match[0]);
        return !isNaN(num) && num > 0 ? num : undefined;
      }
    }
    return undefined;
  };

  const cleanDate = (val: any): string | undefined => {
    const raw = cleanString(val);
    if (!raw) return undefined;
    const lower = raw.toLowerCase();
    if (lower === "present" || lower === "current" || lower === "now" || lower === "ongoing" || lower === "n/a" || lower === "none") {
      return undefined;
    }
    const matchIso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (matchIso) {
      const [, y, m, d] = matchIso;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const matchYearMonth = raw.match(/^(\d{4})[-/](\d{1,2})$/);
    if (matchYearMonth) {
      const [, y, m] = matchYearMonth;
      return `${y}-${m.padStart(2, "0")}`;
    }
    const matchYear = raw.match(/^(\d{4})$/);
    if (matchYear) {
      return matchYear[1];
    }
    const parsedDate = new Date(raw);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().substring(0, 10);
    }
    return undefined;
  };

  const rawRefs = parsed.characterReferences || parsed.character_references || parsed.references || parsed.character_reference || parsed.characterReference;

  return {
    firstName: cleanTitleString(parsed.firstName || parsed.first_name || parsed.givenName || parsed.given_name),
    middleName: cleanTitleString(parsed.middleName || parsed.middle_name || parsed.middleInitial),
    lastName: cleanTitleString(parsed.lastName || parsed.last_name || parsed.surname || parsed.family_name),
    email: cleanString(parsed.email || parsed.emailAddress)?.toLowerCase(),
    mobileNumber: cleanString(parsed.mobileNumber || parsed.mobile_number || parsed.contactNumber || parsed.contact_number || parsed.phone || parsed.phoneNumber),
    dateOfBirth: cleanDate(parsed.dateOfBirth || parsed.date_of_birth || parsed.birthDate || parsed.birth_date || parsed.birthday || parsed.dob),
    birthPlace: cleanTitleString(parsed.birthPlace || parsed.birth_place || parsed.placeOfBirth || parsed.place_of_birth || parsed.birthLocation),
    gender: cleanTitleString(parsed.gender || parsed.sex),
    nationality: cleanTitleString(parsed.nationality || parsed.citizenship),
    civilStatus: cleanTitleString(parsed.civilStatus || parsed.civil_status || parsed.maritalStatus || parsed.marital_status),
    religion: cleanTitleString(parsed.religion || parsed.religiousAffiliation),
    height: cleanNumber(parsed.height || parsed.heightCm),
    weight: cleanNumber(parsed.weight || parsed.weightKg),
    address: cleanTitleString(parsed.address),
    city: cleanTitleString(parsed.city),
    province: cleanTitleString(parsed.province),
    preferredWorkLocations: cleanTitleString(parsed.preferredWorkLocations || parsed.preferred_work_locations || parsed.workLocations),
    professionalSummary: cleanSentenceString(parsed.professionalSummary || parsed.professional_summary || parsed.summary || parsed.objective),
    skills: Array.isArray(parsed.skills)
      ? parsed.skills.map((s: any) => normalizeSkill(s)).filter(Boolean)
      : [],
    educations: Array.isArray(parsed.educations)
      ? parsed.educations
          .filter((edu: any) => edu && typeof (edu.school || edu.institution || edu.schoolName) === "string" && (edu.school || edu.institution || edu.schoolName).trim())
          .map((edu: any) => {
            const rawSchool = String(edu.school || edu.institution || edu.schoolName).trim();
            const rawDegree = cleanString(edu.degree) || "Degree / Certificate";
            const rawField = cleanString(edu.fieldOfStudy || edu.field) || "General";
            return {
              school: normalizeTitleCase(rawSchool) || rawSchool,
              degree: normalizeTitleCase(rawDegree) || rawDegree,
              fieldOfStudy: normalizeTitleCase(rawField) || rawField,
              startDate: cleanDate(edu.startDate || edu.start_date),
              endDate: cleanDate(edu.endDate || edu.end_date),
              notes: cleanSentenceString(edu.notes),
            };
          })
      : [],
    workExperiences: Array.isArray(parsed.workExperiences)
      ? parsed.workExperiences
          .filter((exp: any) => exp && typeof (exp.company || exp.employer) === "string" && typeof (exp.roleTitle || exp.title || exp.jobTitle) === "string")
          .map((exp: any) => {
            const rawCompany = String(exp.company || exp.employer).trim();
            const rawRole = String(exp.roleTitle || exp.title || exp.jobTitle).trim();
            const rawEnd = cleanString(exp.endDate || exp.end_date);
            const isEndPresent = rawEnd ? /^(present|current|now|ongoing)$/i.test(rawEnd) : false;
            const isCurrent = Boolean(exp.isCurrent || exp.is_current || isEndPresent);
            return {
              company: normalizeTitleCase(rawCompany) || rawCompany,
              roleTitle: normalizeTitleCase(rawRole) || rawRole,
              location: cleanTitleString(exp.location),
              startDate: cleanDate(exp.startDate || exp.start_date),
              endDate: isCurrent ? undefined : cleanDate(rawEnd),
              isCurrent,
              summary: cleanSentenceString(exp.summary || exp.description),
            };
          })
      : [],
    trainings: Array.isArray(parsed.trainings)
      ? parsed.trainings
          .filter((t: any) => t && typeof (t.title || t.name) === "string" && (t.title || t.name).trim())
          .map((t: any) => {
            const rawTitle = String(t.title || t.name).trim();
            return {
              title: normalizeTitleCase(rawTitle) || rawTitle,
              provider: cleanTitleString(t.provider || t.issuer),
              completionDate: cleanDate(t.completionDate || t.completion_date || t.issueDate),
              certificateNo: cleanString(t.certificateNo || t.certificate_no || t.licenseNo),
              notes: cleanSentenceString(t.notes),
            };
          })
      : [],
    characterReferences: Array.isArray(rawRefs)
      ? rawRefs
          .filter((ref: any) => ref && cleanString(ref.name || ref.full_name || ref.fullName || ref.contactPerson))
          .map((ref: any) => {
            const rawName = String(cleanString(ref.name || ref.full_name || ref.fullName || ref.contactPerson));
            return {
              name: normalizeTitleCase(rawName) || rawName,
              relationship: cleanTitleString(ref.relationship || ref.position || ref.role || ref.jobTitle || ref.title),
              company: cleanTitleString(ref.company || ref.organization || ref.employer || ref.companyName),
              phone: cleanString(ref.phone || ref.mobileNumber || ref.contactNumber || ref.contact_number || ref.phoneNumber),
              email: cleanString(ref.email || ref.emailAddress)?.toLowerCase(),
              notes: cleanSentenceString(ref.notes || ref.remarks),
            };
          })
      : [],
  };
};

// Prompts Gemini to parse structured candidate profile details from resume text.
export const extractResumeProfileData = async (
  resumeText: string
): Promise<ExtractedProfileData> => {
  if (!resumeText || !resumeText.trim()) {
    throw new Error("Resume text is empty or unreadable");
  }

  const ai = getGeminiClient();
  const prompt = `
You are an expert HR data parser. Your task is to extract structured applicant profile details from the provided resume text.

CANDIDATE RESUME:
${resumeText}

Extract the following information accurately. Respond with a JSON object matching this exact structure:
${RESUME_EXTRACTION_SCHEMA}
`.trim();

  const modelName = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const parsed = parseGeminiJsonResponse(response.text || "");
  return mapParsedProfileData(parsed);
};

// Multimodal PDF parsing fallback directly using Gemini document understanding
export const extractResumeProfileDataFromBuffer = async (
  pdfBuffer: Buffer
): Promise<ExtractedProfileData> => {
  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error("PDF buffer is empty");
  }

  const ai = getGeminiClient();
  const prompt = `
You are an expert HR data parser. Your task is to extract structured applicant profile details from the attached resume PDF document.

Extract the following information accurately. Respond with a JSON object matching this exact structure:
${RESUME_EXTRACTION_SCHEMA}
`.trim();

  const modelName = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBuffer.toString("base64"),
        },
      },
      prompt,
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  const parsed = parseGeminiJsonResponse(response.text || "");
  return mapParsedProfileData(parsed);
};


