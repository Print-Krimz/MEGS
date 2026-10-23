import prisma from "../../utils/prisma.js";
import supabase from "../../utils/supabase.js";
import { ensureBucketExists } from "../../middleware/upload.middleware.js";
import { MAX_DOCUMENT_BYTES } from "../../security/file-validation.js";
import { logAudit } from "../../utils/audit.js";
import { ResumeMergeError, findProfileIdByCandidateId, getLatestProposal, parseResumeToProposal } from "../applicant/resume-merge.service.js";

const STORED_DOCUMENT_URL = /^\/api\/documents\/(\d+)(?:\/download)?$/;

/** Latest parse attempt for a profile, in the shape the TA screen needs to show progress. */
export const getParseSummary = async (profileId: number) => {
  const row = await prisma.resumeParseResult.findFirst({
    where: { applicantProfileId: profileId },
    orderBy: { createdAt: "desc" },
    select: { status: true, source: true, createdAt: true, errorCategory: true, reviewedAt: true },
  });
  if (!row) return null;
  return {
    status: row.status,
    source: row.source,
    createdAt: row.createdAt,
    errorCategory: row.errorCategory,
    reviewed: row.reviewedAt != null,
  };
};

/** What the TA screen needs: the unreviewed proposal (if any) and the state of the latest parse. */
export const getResumeReviewState = async (profileId: number) => ({
  pending: await getLatestProposal(profileId),
  parse: await getParseSummary(profileId),
});

/**
 * Reads the candidate's resume again and stores the result as a new proposal. Nothing is written to the profile:
 * the TA reviews and applies it. The document must belong to this candidate.
 */
export const reparseCandidateResume = async (input: { candidateId: string; documentId?: number; actorUserId: string }) => {
  const profileId = await findProfileIdByCandidateId(input.candidateId);
  if (!profileId) throw new ResumeMergeError("Candidate not found", 404);
  const profile = await prisma.applicantProfile.findUnique({ where: { id: profileId }, select: { id: true, userId: true, resumeUrl: true } });
  if (!profile) throw new ResumeMergeError("Candidate not found", 404);

  let documentId = input.documentId;
  if (documentId === undefined) {
    const match = profile.resumeUrl?.trim().match(STORED_DOCUMENT_URL);
    if (!match) throw new ResumeMergeError("This candidate has no stored resume to read", 404);
    documentId = Number(match[1]);
  }

  const doc = await prisma.storedDocument.findFirst({
    where: { id: documentId, deletedAt: null, OR: [{ profileId: profile.id }, { ownerId: profile.userId }] },
  });
  if (!doc) throw new ResumeMergeError("Document not found", 404);
  if (doc.sizeBytes > MAX_DOCUMENT_BYTES) throw new ResumeMergeError("Document is too large to read", 413);

  await ensureBucketExists(doc.storageBucket);
  const { data, error } = await supabase.storage.from(doc.storageBucket).download(doc.storagePath);
  if (error || !data) throw new ResumeMergeError("Could not open the stored document", 502);

  const parse = await parseResumeToProposal({
    profileId: profile.id,
    buffer: Buffer.from(await data.arrayBuffer()),
    mimeType: doc.mimeType,
    originalName: doc.originalName,
    documentId: doc.id,
    sha256: doc.sha256,
    source: "TA_REPARSE",
  });
  await logAudit(input.actorUserId, "TA_RESUME_REPARSED", "ApplicantProfile", profile.id, { parseId: parse.id, documentId: doc.id, status: parse.status });
  return getResumeReviewState(profile.id);
};
