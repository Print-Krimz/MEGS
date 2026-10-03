import PQueue from "p-queue";
import prisma from "../utils/prisma.js";
import supabase from "../utils/supabase.js";
import { analyzeResume, analyzeResumeFromBuffer } from "../utils/gemini.js";
import { sendNotification, sendRoleNotification } from "../utils/notification.js";

import { validateDocumentBytes, MAX_DOCUMENT_BYTES } from "../security/file-validation.js";
import { extractDocumentText } from "../security/document-parser.js";
import { downloadLegacyResume } from "../security/legacy-resume-download.js";
import { ensureBucketExists } from "../middleware/upload.middleware.js";
import { safeLogError } from "../security/errors.js";

// Concurrency 1 prevents rate limit exhaustion against Gemini API
const queue = new PQueue({ concurrency: 1 });

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
  postedById?: string | null
): Promise<void> => {
  const title = "Application Needs Attention";
  const message = `Resume analysis failed for an applicant on "${jobTitle}". Manual review required.`;
  const type = "WARNING";
  const link = `/ta/applications/${applicationId}`;

  if (postedById) {
    await sendNotification(postedById, title, message, type, link);
  } else {
    await sendRoleNotification("TALENT_ACQUISITION", title, message, type, link);
  }
};

export const processResumeJob = async (applicationId: number): Promise<void> => {
  console.log(`[Worker] Starting analysis for application #${applicationId}`);

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      userId: true,
      status: true,
      resumeUrl: true,
      jobPosting: {
        select: {
          title: true,
          postedById: true,
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

  const jobTitle = application.jobPosting?.title || "Requisition";
  const postedById = application.jobPosting?.postedById;

  if (!application.resumeUrl) {
    console.error(`[Worker] Application #${applicationId} has no resume URL. Skipping.`);
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        aiSummary: "Analysis failed: No resume was attached to this application.",
        status: "NEEDS_ATTENTION",
      },
    });
    await notifyNeedsAttention(applicationId, jobTitle, postedById);
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
    await notifyNeedsAttention(applicationId, jobTitle, postedById);
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

  let analysis;
  try {
    if (isDocx) {
      const resumeText = await extractDocumentText(buffer, detectedMime);
      if (!resumeText) {
        throw new Error("Word document contained no extractable text");
      }
      analysis = await analyzeResume(
        resumeText,
        application.jobPosting.title,
        compositeRequirements
      );
    } else if (isImage) {
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
    try {
      await prisma.application.update({
        where: { id: applicationId },
        data: {
          status: "NEEDS_ATTENTION",
          aiSummary: `Analysis failed: Could not process resume. Manual review required. Reference: ${reference}`,
        },
      });
      await notifyNeedsAttention(applicationId, jobTitle, postedById);
    } catch {
      // ignore if record was deleted concurrently
    }
    return;
  }

  // Simply save the AI score and summary. The categorization engine will handle state transitions.
  try {
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
  } catch (saveErr: any) {
    if (saveErr.code === "P2025") {
      console.warn(`[Worker] Application #${applicationId} was removed before analysis could be saved.`);
      return;
    }
    throw saveErr;
  }
};

const admittedApplications = new Set<number>();
export const ensureResumeQueueCapacity = (applicationId?: number): void => {
  if (applicationId && admittedApplications.has(applicationId)) return;
  if (queue.size + queue.pending >= 100) {
    const error = new Error("Resume analysis queue is busy. Please retry later.");
    Object.assign(error, { status: 429 });
    throw error;
  }
};
export const enqueueResumeAnalysis = (applicationId: number): void => {
  if (admittedApplications.has(applicationId)) return;
  ensureResumeQueueCapacity(applicationId);
  admittedApplications.add(applicationId);
  void queue.add(async () => {
    try { await processResumeJob(applicationId); }
    catch { console.error(`[Worker] Resume job failed for application #${applicationId}`); }
    finally { admittedApplications.delete(applicationId); }
  }).catch(() => {
    admittedApplications.delete(applicationId);
    console.error(`[Worker] Resume queue failed for application #${applicationId}`);
  });

  console.log(`[Worker] Application #${applicationId} queued for analysis. Queue size: ${queue.size + queue.pending}`);
};

export const getQueueStatus = () => ({
  size: queue.size,
  pending: queue.pending,
});
