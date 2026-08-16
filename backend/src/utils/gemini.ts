import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

const getGeminiClient = (): GoogleGenAI => {
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
