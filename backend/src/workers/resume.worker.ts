import PQueue from "p-queue";
import prisma from "../utils/prisma.js";
import { analyzeResume } from "../utils/gemini.js";

// Handle CommonJS export variations in ESM runtime
const _pdfMod = require("pdf-parse");
const pdfParse: (buf: Buffer) => Promise<{ text: string }> =
  typeof _pdfMod === "function" ? _pdfMod : (_pdfMod.default ?? _pdfMod);

// Concurrency 1 prevents rate limit exhaustion against Gemini API
const queue = new PQueue({ concurrency: 1 });

const MATCH_SCORE_THRESHOLD = 60;

const processResumeJob = async (applicationId: number): Promise<void> => {
  console.log(`[Worker] Starting analysis for application #${applicationId}`);

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      resumeUrl: true,
      jobPosting: {
        select: { title: true, requirements: true },
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
        status: "TALENT_POOL",
      },
    });
    return;
  }

  let resumeText = "";
  try {
    const response = await fetch(application.resumeUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} when fetching resume`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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
        status: "TALENT_POOL",
      },
    });
    return;
  }

  let analysis;
  try {
    analysis = await analyzeResume(
      resumeText,
      application.jobPosting.title,
      application.jobPosting.requirements
    );
    console.log(`[Worker] Gemini returned score ${analysis.score} for application #${applicationId}`);
  } catch (err: any) {
    console.error(`[Worker] Gemini analysis failed for #${applicationId}:`, err.message);
    // Reset to SUBMITTED so TA can trigger manual re-try
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: "SUBMITTED",
        aiSummary: `Analysis failed: Gemini API error. (${err.message})`,
      },
    });
    return;
  }

  const nextStatus = analysis.score >= MATCH_SCORE_THRESHOLD ? "MATCHED" : "TALENT_POOL";

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      aiScore: analysis.score,
      aiSummary: JSON.stringify({
        summary: analysis.summary,
        strengths: analysis.strengths,
        gaps: analysis.gaps,
      }),
      status: nextStatus,
    },
  });

  console.log(
    `[Worker] ✅ Application #${applicationId} scored ${analysis.score}/100 → moved to ${nextStatus}`
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
