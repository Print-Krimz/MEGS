import PQueue from "p-queue";
import prisma from "../utils/prisma.js";
import { analyzeResume } from "../utils/gemini.js";

import pdfParseModule from "pdf-parse";
const pdfParse: (buf: Buffer) => Promise<{ text: string }> =
  typeof pdfParseModule === "function" ? pdfParseModule : ((pdfParseModule as any)?.default ?? pdfParseModule);

// Concurrency 1 prevents rate limit exhaustion against Gemini API
const queue = new PQueue({ concurrency: 1 });

const MATCH_SCORE_THRESHOLD = 60;

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

  // AI is advisory only. Both high and low scores move to REVIEW for human TA evaluation.
  const nextStatus = "REVIEW";

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

  try {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { userId: true },
    });
    if (app && application.status !== nextStatus) {
      await prisma.recruiterDecision.create({
        data: {
          applicationId,
          actorId: app.userId,
          fromStatus: application.status,
          toStatus: nextStatus,
          reason: `AI resume analysis completed (Score: ${analysis.score}/100)`,
        },
      });
    }
  } catch {
    // Non-blocking decision recording
  }

  console.log(
    `[Worker] ✅ Application #${applicationId} scored ${analysis.score}/100 → moved to REVIEW`
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
