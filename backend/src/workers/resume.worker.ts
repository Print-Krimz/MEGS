import { BoundedWorkQueue } from "../security/bounded-work-queue.js";
import prisma from "../utils/prisma.js";
import supabase from "../utils/supabase.js";
import { analyzeResume, analyzeResumeFromBuffer } from "../utils/gemini.js";
import { notifyJobOwner } from "../utils/notification.js";
import type { JobOwnerFields } from "../services/ta/ownership.js";

import { validateDocumentBytes, MAX_DOCUMENT_BYTES } from "../security/file-validation.js";
import { extractDocumentText } from "../security/document-parser.js";
import { downloadLegacyResume } from "../security/legacy-resume-download.js";
import { ensureBucketExists } from "../middleware/upload.middleware.js";
import { safeLogError } from "../security/errors.js";
import { checkResumeIdentity } from "../services/ta/resume-identity.js";

// Concurrency 1 prevents rate limit exhaustion against Gemini API
// One active job; other producers wait for admission, never a total-count rejection.
const queue = new BoundedWorkQueue(1, 1);

// In-memory progress so the TA screen can show each analysis step live.
// Entries for finished runs expire after a few minutes.
export type AnalysisPhase =
  | "QUEUED"
  | "READING_RESUME"
  | "EXTRACTING_TEXT"
  | "AI_ANALYSIS"
  | "SCORING"
  | "DONE"
  | "FAILED";

export interface AnalysisProgress {
  phase: AnalysisPhase;
  startedAt: string;
  updatedAt: string;
  /** Gemini resume review score. */
  score?: number;
  /** Rule-based match score shown on the application page (latest CandidateScore). */
  fitScore?: number | null;
  requirementsMet?: number;
  requirementsTotal?: number;
  /** Why a FAILED run stopped, so TA can tell a missing resume from a busy service. */
  failureReason?: AnalysisFailureReason;
}

export type AnalysisFailureReason = "NOT_FOUND" | "NO_RESUME" | "UNREADABLE_RESUME" | "AI_UNAVAILABLE" | "SAVE_FAILED";

const analysisProgress = new Map<number, AnalysisProgress>();
const PROGRESS_TTL_MS = 5 * 60 * 1000;

const setPhase = (applicationId: number, phase: AnalysisPhase, extra: Partial<AnalysisProgress> = {}) => {
  const now = new Date().toISOString();
  const previous = analysisProgress.get(applicationId);
  const startedAt = phase === "QUEUED" || !previous ? now : previous.startedAt;
  analysisProgress.set(applicationId, { phase, startedAt, updatedAt: now, ...extra });
  if (phase === "DONE" || phase === "FAILED") {
    setTimeout(() => {
      if (analysisProgress.get(applicationId)?.updatedAt === now) analysisProgress.delete(applicationId);
    }, PROGRESS_TTL_MS).unref?.();
  }
};

export const getAnalysisProgress = (applicationId: number): AnalysisProgress | null =>
  analysisProgress.get(applicationId) ?? null;

// Match-score recalculations started alongside an analysis. The rule-based match score
// owns the MATCHED/REVIEW decision; the job waits for it so it can (a) fall back to the
// AI estimate only when no match score could be calculated and (b) report the score the
// application page shows.
const fitRevalidations = new Map<number, Promise<unknown>>();
export const trackFitRevalidation = (applicationId: number, promise: Promise<unknown>) => {
  const settled = promise.catch(() => undefined);
  fitRevalidations.set(applicationId, settled);
  void settled.finally(() => {
    if (fitRevalidations.get(applicationId) === settled) fitRevalidations.delete(applicationId);
  });
};

const latestFitScore = async (applicationId: number): Promise<number | null> => {
  await fitRevalidations.get(applicationId);
  const latest = await prisma.candidateScore.findFirst({
    // Only a current score counts; a STALE row from an older configuration must not stop
    // the AI-estimate fallback from moving the application out of PARSING.
    where: { applicationId, status: "CALCULATED" },
    orderBy: { calculatedAt: "desc" },
    select: { finalFitScore: true },
  });
  return latest ? Number(latest.finalFitScore) : null;
};

export interface ResumeFilePayload {
  buffer: Buffer;
  mimeType?: string;
  originalName?: string;
}

export const fetchResumePayload = async (resumeUrl: string, ownerId?: string): Promise<ResumeFilePayload> => {
  if (!resumeUrl || typeof resumeUrl !== "string") {
    throw new Error("Invalid or empty resume URL provided");
  }

  const cleanUrl = resumeUrl.trim();

  // Check if URL is an internal StoredDocument reference (e.g. /api/documents/3/download or /api/documents/3)
  const match = cleanUrl.match(/^\/api\/documents\/(\d+)(?:\/download)?$/);
  if (match) {
    const documentId = parseInt(match[1], 10);
    const doc = await prisma.storedDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc || !ownerId || doc.ownerId !== ownerId) {
      throw new Error(`Stored document #${documentId} referenced in application resumeUrl was not found in the database.`);
    }

    if (doc.sizeBytes > MAX_DOCUMENT_BYTES) throw new Error("Resume exceeds supported size limits");
    await ensureBucketExists(doc.storageBucket);
    const { data, error } = await supabase.storage
      .from(doc.storageBucket)
      .download(doc.storagePath);
    if (error || !data) {
      throw new Error("Unable to download stored resume");
    }
    if (data.size > MAX_DOCUMENT_BYTES) throw new Error("Resume exceeds supported size limits");
    const arrayBuffer = await data.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: doc.mimeType,
      originalName: doc.originalName || doc.storagePath,
    };
  }

  return downloadLegacyResume(cleanUrl);
};

export const fetchResumeBuffer = async (resumeUrl: string, ownerId?: string): Promise<Buffer> => {
  const payload = await fetchResumePayload(resumeUrl, ownerId);
  return payload.buffer;
};

export const detectDocumentFormat = (
  mimeType?: string,
  fileNameOrUrl?: string
): { isDocx: boolean; isImage: boolean; isPdf: boolean; detectedMime: string } => {
  const cleanMime = (mimeType || "").trim().toLowerCase();
  const cleanName = (fileNameOrUrl || "").trim().toLowerCase().split("?")[0];
  const ext = cleanName.split(".").pop() || "";
  const recognizedMime = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword", "image/jpeg", "image/png", "image/webp"].includes(cleanMime);

  const isDocx =
    cleanMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    cleanMime === "application/msword" ||
    !recognizedMime && (ext === "docx" || ext === "doc");

  const isImage =
    cleanMime.startsWith("image/") ||
    !recognizedMime && ["jpg", "jpeg", "png", "webp"].includes(ext);

  let detectedMime = "application/pdf";
  if (isDocx) {
    detectedMime = cleanMime.includes("word") || cleanMime.includes("msword")
      ? cleanMime
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else if (isImage) {
    if (cleanMime.startsWith("image/")) {
      detectedMime = cleanMime;
    } else if (ext === "png") {
      detectedMime = "image/png";
    } else if (ext === "webp") {
      detectedMime = "image/webp";
    } else {
      detectedMime = "image/jpeg";
    }
  }

  const isPdf = !isDocx && !isImage;

  return { isDocx, isImage, isPdf, detectedMime };
};

const notifyNeedsAttention = async (
  applicationId: number,
  jobTitle: string,
  jobPosting: JobOwnerFields | null | undefined
): Promise<void> => {
  const title = "Application Needs Attention";
  const message = `Resume analysis failed for an applicant on "${jobTitle}". Manual review required.`;
  const type = "WARNING";
  const link = `/ta/applications/${applicationId}`;

  await notifyJobOwner(jobPosting, title, message, type, link);
};

export const processResumeJob = async (applicationId: number): Promise<void> => {
  console.log(`[Worker] Starting analysis for application #${applicationId}`);
  setPhase(applicationId, "READING_RESUME");

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      userId: true,
      status: true,
      resumeUrl: true,
      user: {
        select: {
          email: true,
          applicantProfile: { select: { firstName: true, lastName: true, mobileNumber: true } },
        },
      },
      jobPosting: {
        select: {
          title: true,
          postedById: true,
          mrfId: true,
          requirements: true,
          mrf: {
            select: {
              title: true,
              assignedTaId: true,
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
    setPhase(applicationId, "FAILED", { failureReason: "NOT_FOUND" });
    return;
  }

  const jobTitle = application.jobPosting?.title || "Requisition";
  const jobPosting = application.jobPosting;

  if (!application.resumeUrl) {
    console.error(`[Worker] Application #${applicationId} has no resume URL. Skipping.`);
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        aiSummary: "Analysis failed: No resume was attached to this application.",
        status: "NEEDS_ATTENTION",
      },
    });
    setPhase(applicationId, "FAILED", { failureReason: "NO_RESUME" });
    await notifyNeedsAttention(applicationId, jobTitle, jobPosting);
    return;
  }

  let payload: ResumeFilePayload;
  try {
    payload = await fetchResumePayload(application.resumeUrl, application.userId);
    const declaredMime = payload.mimeType?.split(";")[0]?.trim().toLowerCase();
    // Historic storage commonly used generic binary metadata. Actual bytes
    // remain authoritative; a specific but contradictory type still fails.
    const validated = validateDocumentBytes(payload.buffer, declaredMime === "application/octet-stream" ? undefined : declaredMime);
    payload.mimeType = validated.mimeType;
  } catch (err: any) {
    const reference = safeLogError(`Worker: read resume for application #${applicationId}`, err);
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        aiSummary: `Analysis failed: Could not read the resume file. Manual review required. Reference: ${reference}`,
        status: "NEEDS_ATTENTION",
      },
    });
    setPhase(applicationId, "FAILED", { failureReason: "UNREADABLE_RESUME" });
    await notifyNeedsAttention(applicationId, jobTitle, jobPosting);
    return;
  }

  const { buffer } = payload;
  const { isDocx, isImage, detectedMime } = detectDocumentFormat(
    payload.mimeType,
    payload.originalName || application.resumeUrl
  );

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

  setPhase(applicationId, "EXTRACTING_TEXT");
  let analysis;
  try {
    if (isDocx) {
      const resumeText = await extractDocumentText(buffer, detectedMime);
      if (!resumeText) {
        throw new Error("Word document contained no extractable text");
      }
      setPhase(applicationId, "AI_ANALYSIS");
      analysis = await analyzeResume(
        resumeText,
        application.jobPosting.title,
        compositeRequirements
      );
    } else if (isImage) {
      setPhase(applicationId, "AI_ANALYSIS");
      analysis = await analyzeResumeFromBuffer(
        buffer,
        detectedMime,
        application.jobPosting.title,
        compositeRequirements
      );
    } else {
      // PDF or fallback
      let resumeText = "";
      try {
        resumeText = await extractDocumentText(buffer, "application/pdf");
      } catch (pdfErr: any) {
        console.warn(`[Worker] PDF text extraction unavailable for #${applicationId}; attempting bounded multimodal analysis.`);
      }

      setPhase(applicationId, "AI_ANALYSIS");
      if (resumeText && resumeText.length > 50) {
        analysis = await analyzeResume(
          resumeText,
          application.jobPosting.title,
          compositeRequirements
        );
      } else {
        console.log(`[Worker] PDF contains sparse or no extractable text (${resumeText.length} chars). Falling back to multimodal vision analysis for #${applicationId}`);
        analysis = await analyzeResumeFromBuffer(
          buffer,
          "application/pdf",
          application.jobPosting.title,
          compositeRequirements
        );
      }
    }
    console.log(`[Worker] Gemini returned score ${analysis.score} for application #${applicationId}`);
  } catch (err: any) {
    const reference = safeLogError(`Worker: analyze application #${applicationId}`, err);
    setPhase(applicationId, "FAILED", { failureReason: "AI_UNAVAILABLE" });
    try {
      await prisma.application.update({
        where: { id: applicationId },
        data: {
          status: "NEEDS_ATTENTION",
          aiSummary: `Analysis failed: Could not process resume. Manual review required. Reference: ${reference}`,
        },
      });
      await notifyNeedsAttention(applicationId, jobTitle, jobPosting);
    } catch {
      // ignore if record was deleted concurrently
    }
    return;
  }

  // Save the requirement checklist and summary. Status is decided by the match score.
  setPhase(applicationId, "SCORING");
  try {
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        aiScore: analysis.score,
        aiSummary: JSON.stringify({
          summary: analysis.summary,
          strengths: analysis.strengths,
          gaps: analysis.gaps,
          requirements: analysis.requirements,
          // Only the comparison result is stored, not the resume's contact details.
          identityCheck: checkResumeIdentity(analysis.resumeIdentity, {
            ...application.user?.applicantProfile,
            email: application.user?.email,
          }),
        }),
      },
    });

    // undefined = the read failed; never let a database hiccup hand status to the AI estimate.
    const fitScore = await latestFitScore(applicationId).catch((error) => {
      safeLogError(`Worker: read match score for application #${applicationId}`, error);
      return undefined;
    });
    if (fitScore === null) {
      // No profile-based match score (e.g. no applicant profile yet): use the AI estimate.
      const { applyScoreCategorization } = await import("../services/ta/ta.applications.service.js");
      await applyScoreCategorization(applicationId, analysis.score);
    }
    setPhase(applicationId, "DONE", {
      score: analysis.score,
      fitScore,
      requirementsMet: analysis.requirements.filter((check) => check.result === "MET").length,
      requirementsTotal: analysis.requirements.length,
    });
    console.log(
      `[Worker] ✅ Application #${applicationId} scored ${analysis.score}/100 and categorized.`
    );
  } catch (saveErr: any) {
    if (saveErr.code === "P2025") {
      console.warn(`[Worker] Application #${applicationId} was removed before analysis could be saved.`);
      setPhase(applicationId, "FAILED", { failureReason: "NOT_FOUND" });
      return;
    }
    throw saveErr;
  }
};

const admittedApplications = new Set<number>();
export const enqueueResumeAnalysis = async (applicationId: number): Promise<void> => {
  if (admittedApplications.has(applicationId)) return;
  admittedApplications.add(applicationId);
  setPhase(applicationId, "QUEUED");
  try {
    await queue.admit(async () => {
      try { await processResumeJob(applicationId); }
      catch (error) {
        safeLogError(`Worker: application #${applicationId}`, error);
        setPhase(applicationId, "FAILED", { failureReason: "SAVE_FAILED" });
        await prisma.application.updateMany({ where: { id: applicationId }, data: {
          status: "NEEDS_ATTENTION", aiSummary: "Analysis could not be saved. Retry resume analysis or review manually.",
        } });
      }
      finally { admittedApplications.delete(applicationId); }
    });
  } catch (error) { admittedApplications.delete(applicationId); analysisProgress.delete(applicationId); throw error; }
  console.log(`[Worker] Application #${applicationId} queued for analysis. Queue size: ${queue.size + queue.pending}`);
};
export const waitForResumeQueue = () => queue.onIdle();

export const getQueueStatus = () => ({
  size: queue.size,
  pending: queue.pending,
});
