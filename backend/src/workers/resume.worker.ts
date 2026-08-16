import PQueue from "p-queue";
import prisma from "../utils/prisma.js";
import supabase from "../utils/supabase.js";
import { analyzeResume } from "../utils/gemini.js";

// @ts-ignore
import pdfParseModule from "pdf-parse/lib/pdf-parse.js";
const pdfParse: (buf: Buffer) => Promise<{ text: string }> =
  typeof pdfParseModule === "function" ? pdfParseModule : ((pdfParseModule as any)?.default ?? pdfParseModule);

// Concurrency 1 prevents rate limit exhaustion against Gemini API
const queue = new PQueue({ concurrency: 1 });

export const fetchResumeBuffer = async (resumeUrl: string): Promise<Buffer> => {
  if (!resumeUrl || typeof resumeUrl !== "string") {
    throw new Error("Invalid or empty resume URL provided");
  }

  const cleanUrl = resumeUrl.trim();

  // Check if URL is an internal StoredDocument reference (e.g. /api/documents/3/download or /api/documents/3)
  const match = cleanUrl.match(/\/api\/documents\/(\d+)(?:\/download)?/);
  if (match) {
    const documentId = parseInt(match[1], 10);
    const doc = await prisma.storedDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc) {
      throw new Error(`Stored document #${documentId} referenced in application resumeUrl was not found in the database.`);
    }

    const { data, error } = await supabase.storage
      .from(doc.storageBucket)
      .download(doc.storagePath);
    if (error || !data) {
      throw new Error(`Failed to download resume from storage (${doc.storageBucket}/${doc.storagePath}): ${error?.message || "Not found"}`);
    }
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // Fallback to HTTP fetch (handling relative URLs if any)
  let fetchUrl = cleanUrl;
  if (fetchUrl.startsWith("/")) {
    const port = process.env.PORT || 3000;
    fetchUrl = `http://localhost:${port}${fetchUrl}`;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(fetchUrl);
  } catch (err: any) {
    throw new Error(`Invalid resume URL format: ${fetchUrl}`);
  }

  const response = await fetch(parsedUrl.toString());
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} when fetching resume`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

export const processResumeJob = async (applicationId: number): Promise<void> => {
  console.log(`[Worker] Starting analysis for application #${applicationId}`);

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      resumeUrl: true,
      jobPosting: {
        select: {
          title: true,
          requirements: true,
          mrf: {
            select: {
              title: true,
              requiredSkills: true,
              requiredExperience: true,
              requiredEducation: true,
              requiredCertifications: true,
              description: true,
            },
          },
        },
      },
    },
  });

  if (!application) {
    console.error(`[Worker] Application #${applicationId} not found. Skipping.`);
    return;
  }

  if (!application.resumeUrl) {
    console.error(`[Worker] Application #${applicationId} has no resume URL. Skipping.`);
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        aiSummary: "Analysis failed: No resume was attached to this application.",
        status: "NEEDS_ATTENTION",
      },
    });
    return;
  }

  let resumeText = "";
  try {
    const buffer = await fetchResumeBuffer(application.resumeUrl);
    const parsed = await pdfParse(buffer);
    resumeText = parsed.text.trim();

    if (!resumeText) {
      throw new Error("PDF contained no extractable text (may be image-based or empty)");
    }
  } catch (err: any) {
    console.error(`[Worker] Failed to read resume for #${applicationId}:`, err.message);
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        aiSummary: `Analysis failed: Could not read the resume file. (${err.message})`,
        status: "NEEDS_ATTENTION",
      },
    });
    return;
  }

  // Synthesize authoritative MRF requirements if linked
  let compositeRequirements = application.jobPosting.requirements;
  if (application.jobPosting.mrf) {
    const mrf = application.jobPosting.mrf;
    const mrfParts = [];
    if (mrf.requiredSkills) mrfParts.push(`Required Skills: ${mrf.requiredSkills}`);
    if (mrf.requiredExperience) mrfParts.push(`Required Experience: ${mrf.requiredExperience}`);
    if (mrf.requiredEducation) mrfParts.push(`Required Education: ${mrf.requiredEducation}`);
    if (mrf.requiredCertifications) mrfParts.push(`Required Certifications: ${mrf.requiredCertifications}`);
    if (mrfParts.length > 0) {
      compositeRequirements = `${compositeRequirements}\n\n[MRF Authoritative Requirements]:\n${mrfParts.join("\n")}`;
    }
  }

  let analysis;
  try {
    analysis = await analyzeResume(
      resumeText,
      application.jobPosting.title,
      compositeRequirements
    );
    console.log(`[Worker] Gemini returned score ${analysis.score} for application #${applicationId}`);
  } catch (err: any) {
    console.error(`[Worker] Gemini analysis failed for #${applicationId}:`, err.message);
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: "NEEDS_ATTENTION",
        aiSummary: `Analysis failed: Gemini API error. (${err.message})`,
      },
    });
    return;
  }

  // Simply save the AI score and summary. The categorization engine will handle state transitions.
  await prisma.application.update({
    where: { id: applicationId },
    data: {
      aiScore: analysis.score,
      aiSummary: JSON.stringify({
        summary: analysis.summary,
        strengths: analysis.strengths,
        gaps: analysis.gaps,
      }),
    },
  });

  const { applyScoreCategorization } = await import("../services/ta/ta.applications.service.js");
  await applyScoreCategorization(applicationId, analysis.score);

  console.log(
    `[Worker] ✅ Application #${applicationId} scored ${analysis.score}/100 and categorized.`
  );
};

export const enqueueResumeAnalysis = (applicationId: number): void => {
  queue.add(async () => {
    try {
      await processResumeJob(applicationId);
    } catch (err: any) {
      console.error(`[Worker] Unhandled error for application #${applicationId}:`, err.message);
    }
  });

  console.log(
    `[Worker] Application #${applicationId} queued for analysis. Queue size: ${queue.size + 1}`
  );
};

export const getQueueStatus = () => ({
  size: queue.size,
  pending: queue.pending,
});
