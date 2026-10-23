import { withProviderRetry } from "../security/provider-retry.js";
import { BoundedWorkQueue } from "../security/bounded-work-queue.js";
import { GoogleGenAI, type GenerateContentConfig } from "@google/genai";
import { AI_DATA_INSTRUCTION, aiData, parseAiJson, parseResumeAnalysis } from "../security/ai-output.js";

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

export const getCandidateModels = (): string[] => {
  const envModel = process.env.GEMINI_MODEL?.trim();
  const models = [
    envModel,
    "gemini-2.5-flash-lite",
    "gemini-3-flash-preview",
    "gemini-flash-latest",
    "gemini-3.6-flash",
  ].filter((m): m is string => Boolean(m && m.length > 0));

  return Array.from(new Set(models));
};

// Settles as soon as the signal aborts, even if the SDK request has not yet observed it.
const abortable = <T>(request: Promise<T>, signal: AbortSignal): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new DOMException("The operation was aborted", "AbortError"));
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    request.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });

const generateUnqueued = async (
  params: {
    contents: any;
    config?: GenerateContentConfig;
  },
  timeoutMs: number = 10000
): Promise<any> => {
  const ai = getGeminiClient();
  const candidateModels = getCandidateModels();
  const callerSignal = params.config?.abortSignal;
  const throwIfCallerAborted = () => {
    if (callerSignal?.aborted) throw callerSignal.reason ?? new DOMException("The operation was aborted", "AbortError");
  };
  throwIfCallerAborted();

  for (const model of candidateModels) {
    let signal: AbortSignal | undefined;
    try {
      const response = await withProviderRetry(async () => {
        throwIfCallerAborted();
        const timeoutSignal = AbortSignal.timeout(timeoutMs);
        const requestSignal = callerSignal ? AbortSignal.any([timeoutSignal, callerSignal]) : timeoutSignal;
        signal = requestSignal;
        try {
          return await abortable(ai.models.generateContent({
            model,
            contents: params.contents,
            config: {
              ...params.config,
              systemInstruction: AI_DATA_INSTRUCTION,
              abortSignal: requestSignal,
              maxOutputTokens: 8192,
            },
          }), requestSignal);
        } catch (error: any) {
          throwIfCallerAborted();
          if (requestSignal.aborted) throw Object.assign(new Error("AI processing timed out"), { name: "TimeoutError" });
          throw error;
        }
      });
      return response;
    } catch (err: any) {
      // Caller cancellation is final: never submit fallback work for a cancelled request.
      if (callerSignal?.aborted) throw callerSignal.reason ?? err;
      if (err?.retryable) throw err;
      console.warn("[Gemini] Request failed; trying the next configured model.");
      // A timeout may still incur provider cost; avoid submitting duplicate work.
      if (signal?.aborted || err?.name === "TimeoutError" || err?.name === "AbortError") throw new Error("AI processing timed out");
    }
  }

  throw new Error("AI processing is temporarily unavailable");
};

// Two active provider calls; waiting producers get admission without a count rejection.
const providerQueue = new BoundedWorkQueue(2, 1);
export const withGeminiCapacity = async <T>(request: () => Promise<T>): Promise<T> => {
  let result!: T;
  const { completion } = await providerQueue.admit(async () => { result = await request(); });
  await completion;
  return result;
};

/**
 * Embedding call with the same 10 s deadline as content generation. The signal is handed to
 * the SDK so the request is cancelled on timeout, and the provider slot is released only
 * after that abort. Timeouts are not retried (withProviderRetry rethrows TimeoutError).
 */
export const embedContentWithDeadline = (
  params: { model: string; contents: any; config?: any },
  timeoutMs: number = 10000,
): Promise<any> => withGeminiCapacity(() => withProviderRetry(async () => {
  const ai = getGeminiClient();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(Object.assign(new Error("AI processing timed out"), { name: "TimeoutError" })), timeoutMs);
  try {
    return await abortable(ai.models.embedContent({
      ...params,
      config: { ...params.config, abortSignal: controller.signal },
    }), controller.signal);
  } catch (error: any) {
    if (controller.signal.aborted) throw Object.assign(new Error("AI processing timed out"), { name: "TimeoutError" });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}));

export const generateContentWithFallback = (
  params: { contents: any; config?: any }, timeoutMs = 10000,
): Promise<any> => withGeminiCapacity(() => generateUnqueued(params, timeoutMs));

export type RequirementCheckResult = "MET" | "PARTIAL" | "NOT_MET" | "UNCLEAR";

export interface RequirementCheck {
  requirement: string;
  result: RequirementCheckResult;
  evidence: string;
}

export interface ResumeAnalysisResult {
  score: number;       // 0–100 AI estimate; used only when no rule-based match score exists
  summary: string;
  strengths: string[];
  gaps: string[];
  requirements: RequirementCheck[];
  resumeIdentity: ResumeIdentity | null;
}

export interface ResumeIdentity {
  name: string | null;
  email: string | null;
  phone: string | null;
}

// Shared response contract for both the text and document analysis prompts.
const RESUME_ANALYSIS_INSTRUCTIONS = `
Respond with a JSON object matching this exact structure:
{
  "requirements": [
    {
      "requirement": "<one requirement from JOB REQUIREMENTS, short, in the employer's own words>",
      "result": "<MET | PARTIAL | NOT_MET | UNCLEAR>",
      "evidence": "<one short sentence citing what the resume says, or what is missing>"
    }
  ],
  "score": <integer from 0 to 100 representing overall fit — 100 is a perfect match>,
  "summary": "<2 to 3 sentence overall assessment of the candidate's fit for this role>",
  "strengths": ["<other strength not already covered by a requirement above>", ...],
  "gaps": ["<other concern not already covered by a requirement above>", ...],
  "resumeIdentity": {
    "name": "<candidate's full name as printed at the top of the resume, or null>",
    "email": "<candidate's own email on the resume, or null>",
    "phone": "<candidate's own phone number on the resume, or null>"
  }
}

Requirement checklist rules:
- Split JOB REQUIREMENTS into its distinct requirements (skills, traits, experience, education, certifications, location). List each once, at most 12.
- MET: the resume clearly shows it. PARTIAL: related or weaker evidence. NOT_MET: the resume shows the candidate lacks it. UNCLEAR: the resume does not mention it either way.
- Judge meaning, not exact wording: "dependable" supports "Responsible"; "team collaboration" supports "Respectful". Requirements may be written in Filipino or English.
- Evidence must come from the resume. Never invent facts.

Strengths and gaps rules:
- Only list points that are NOT already one of the requirements above. Do not repeat a requirement in different words.
- At most 4 strengths and 4 gaps, each one short phrase.

Resume identity rules:
- Copy the resume owner's own name, email and phone exactly as printed. Never use a reference, employer or relative's details. Use null when absent.

Scoring guide:
- 80–100: Excellent match, meets nearly all requirements
- 60–79:  Good match, meets most requirements with minor gaps
- 40–59:  Partial match, meets some requirements
- 0–39:   Poor match, significant gaps

Be objective. Base your assessment only on the resume content vs the stated requirements.
Respond with valid JSON only. Do not include markdown or any text outside the JSON object.
`.trim();

// Prompts Gemini for structured resume scoring. Invoked exclusively via background workers.
export const analyzeResume = async (
  resumeText: string,
  jobTitle: string,
  requirements: string
): Promise<ResumeAnalysisResult> => {
  const prompt = `
You are an expert HR analyst. Your task is to evaluate how well a candidate's resume matches a specific job opening.

JOB TITLE: ${aiData(jobTitle, 1000)}

JOB REQUIREMENTS:
${aiData(requirements, 32_000)}

CANDIDATE RESUME:
${aiData(resumeText)}

Check the resume against each job requirement.
${RESUME_ANALYSIS_INSTRUCTIONS}
`.trim();

  const response = await generateContentWithFallback({
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });
  return parseResumeAnalysis(response.text || "");
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
  barangay?: string;
  postalCode?: string;
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
import {
  normalizeCivilStatus,
  normalizeGender,
  normalizeMobileNumber,
  normalizePostalCode,
  parseHeightCm,
  parseLooseDate,
  parseWeightKg,
} from "./profile-normalizers.js";

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
  "barangay": "<Barangay / Village / Sub-district or null if not found>",
  "city": "<City / Municipality e.g. Calamba, Makati, Quezon City, Manila, Caloocan or null if not found>",
  "province": "<Province / Region e.g. Laguna, Metro Manila, Batangas, Cebu or null if not found>",
  "postalCode": "<4-digit Philippine postal / ZIP code e.g. 1012, 1400 or null if not found>",
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

export const parseGeminiJsonResponse = (text: string): any => parseAiJson(text);

export const mapParsedProfileData = (parsed: any): ExtractedProfileData => {
  const cleanString = (val: any): string | undefined => {
    if (val === undefined || val === null) return undefined;
    if (typeof val !== "string") return undefined;
    const str = val.trim();
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

  const cleanDate = (val: any): string | undefined => parseLooseDate(cleanString(val));

  const rawRefs = parsed.characterReferences || parsed.character_references || parsed.references || parsed.character_reference || parsed.characterReference;

  return {
    firstName: cleanTitleString(parsed.firstName || parsed.first_name || parsed.givenName || parsed.given_name),
    middleName: cleanTitleString(parsed.middleName || parsed.middle_name || parsed.middleInitial),
    lastName: cleanTitleString(parsed.lastName || parsed.last_name || parsed.surname || parsed.family_name),
    email: cleanString(parsed.email || parsed.emailAddress)?.toLowerCase(),
    mobileNumber: normalizeMobileNumber(cleanString(parsed.mobileNumber || parsed.mobile_number || parsed.contactNumber || parsed.contact_number || parsed.phone || parsed.phoneNumber)),
    dateOfBirth: cleanDate(parsed.dateOfBirth || parsed.date_of_birth || parsed.birthDate || parsed.birth_date || parsed.birthday || parsed.dob),
    birthPlace: cleanTitleString(parsed.birthPlace || parsed.birth_place || parsed.placeOfBirth || parsed.place_of_birth || parsed.birthLocation),
    gender: normalizeGender(cleanString(parsed.gender || parsed.sex)),
    nationality: cleanTitleString(parsed.nationality || parsed.citizenship),
    civilStatus: normalizeCivilStatus(cleanString(parsed.civilStatus || parsed.civil_status || parsed.maritalStatus || parsed.marital_status)),
    religion: cleanTitleString(parsed.religion || parsed.religiousAffiliation),
    height: parseHeightCm(parsed.height ?? parsed.heightCm),
    weight: parseWeightKg(parsed.weight ?? parsed.weightKg),
    address: cleanTitleString(parsed.address),
    city: cleanTitleString(parsed.city),
    province: cleanTitleString(parsed.province),
    barangay: cleanTitleString(parsed.barangay || parsed.brgy),
    postalCode: normalizePostalCode(parsed.postalCode ?? parsed.postal_code ?? parsed.zipCode ?? parsed.zip),
    preferredWorkLocations: cleanTitleString(parsed.preferredWorkLocations || parsed.preferred_work_locations || parsed.workLocations),
    professionalSummary: cleanSentenceString(parsed.professionalSummary || parsed.professional_summary || parsed.summary || parsed.objective),
    skills: Array.isArray(parsed.skills)
      ? parsed.skills.filter((s: unknown) => typeof s === "string").map((s: string) => normalizeSkill(s)).filter(Boolean)
      : [],
    educations: Array.isArray(parsed.educations)
      ? parsed.educations
          .filter((edu: any) => edu && typeof (edu.school || edu.institution || edu.schoolName) === "string" && (edu.school || edu.institution || edu.schoolName).trim())
          .map((edu: any) => {
            const rawSchool = String(edu.school || edu.institution || edu.schoolName).trim();
            const rawDegree = cleanString(edu.degree);
            const rawField = cleanString(edu.fieldOfStudy || edu.field);
            return {
              school: normalizeTitleCase(rawSchool) || rawSchool,
              degree: rawDegree ? normalizeTitleCase(rawDegree) || rawDegree : undefined,
              fieldOfStudy: rawField ? normalizeTitleCase(rawField) || rawField : undefined,
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
            const isCurrent = exp.isCurrent === true || exp.is_current === true || isEndPresent;
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

  const prompt = `
You are an expert HR data parser. Your task is to extract structured applicant profile details from the provided resume text.

CANDIDATE RESUME:
${aiData(resumeText)}

Extract the following information accurately. Respond with a JSON object matching this exact structure:
${RESUME_EXTRACTION_SCHEMA}
`.trim();

  const response = await generateContentWithFallback({
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const parsed = parseGeminiJsonResponse(response.text || "");
  return mapParsedProfileData(parsed);
};

// Multimodal document/image parsing fallback directly using Gemini document understanding
export const extractResumeProfileDataFromBuffer = async (
  buffer: Buffer,
  mimeType: string = "application/pdf"
): Promise<ExtractedProfileData> => {
  if (!buffer || buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
    throw new Error("Buffer is empty");
  }

  const resolvedMime = mimeType || "application/pdf";
  const prompt = `
You are an expert HR data parser. Your task is to extract structured applicant profile details from the attached resume document/image.

Extract the following information accurately. Respond with a JSON object matching this exact structure:
${RESUME_EXTRACTION_SCHEMA}
`.trim();

  const response = await generateContentWithFallback({
    contents: [
      {
        inlineData: {
          mimeType: resolvedMime,
          data: buffer.toString("base64"),
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

// Multimodal vision and document analysis for image, photo, or scanned PDF resumes
export const analyzeResumeFromBuffer = async (
  buffer: Buffer,
  mimeType: string,
  jobTitle: string,
  requirements: string
): Promise<ResumeAnalysisResult> => {
  if (!buffer || buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
    throw new Error("Resume buffer is empty");
  }

  const resolvedMime = mimeType || "application/pdf";
  const prompt = `
You are an expert HR analyst. Your task is to evaluate how well a candidate's resume matches a specific job opening.
The candidate resume is provided as an attached document or image (which may be a scanned document, photo of printed/handwritten resume, or PDF). Perform OCR and document understanding as needed.

JOB TITLE: ${aiData(jobTitle, 1000)}

JOB REQUIREMENTS:
${aiData(requirements, 32_000)}

Check the resume document against each job requirement.
${RESUME_ANALYSIS_INSTRUCTIONS}
`.trim();

  const response = await generateContentWithFallback({
    contents: [
      {
        inlineData: {
          mimeType: resolvedMime,
          data: buffer.toString("base64"),
        },
      },
      prompt,
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  return parseResumeAnalysis(response.text || "");
};


