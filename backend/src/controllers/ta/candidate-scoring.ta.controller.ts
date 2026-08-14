import type { Request, Response } from "express";
import { ZodError } from "zod";
import { candidateScoringSchema } from '../../schemas/candidate-scoring.schema.js';
import { listRankedCandidates } from "../../services/scoring/candidate-scoring.service.js";
import { revalidateJobScoring } from "../../services/scoring/scoring-configuration.service.js";
import {
  addToTalentPool,
  considerTalentPoolCandidateForJob,
  discoverTalentPoolForJob,
  findSimilarCandidates,
  InvalidKnnRequestError,
  recordTalentPoolContact,
  searchTalentPoolByText,
} from "../../services/scoring/talent-pool-knn.service.js";
import { sendError, sendSuccess } from '../../utils/response.js';
import { scoringFlags } from '../../utils/scoring-flags.js';
import { logAudit } from '../../utils/audit.js';

const handle = (res: Response, error: unknown) => {
  if (error instanceof ZodError) return res.status(422).json({ success: false, message: "Invalid talent-pool request", code: "INVALID_REQUEST", errors: error.issues.map((issue) => ({ field: issue.path.join("."), code: "INVALID_VALUE", message: issue.message })) });
  if (error instanceof InvalidKnnRequestError) return res.status(422).json({ success: false, message: error.message, code: error.code });
  return sendError(res, error instanceof Error ? error.message : "Unable to process talent-pool request", 500);
};

const requireDynamicScoring = (res: Response) => {
  if (!scoringFlags.dynamicCandidateScoringEnabled()) {
    sendError(res, "Dynamic candidate scoring is disabled by feature flag", 404);
    return false;
  }
  return true;
};

const requireKnnTalentPooling = (res: Response) => requireDynamicScoring(res) && (scoringFlags.knnTalentPoolingEnabled() || (sendError(res, "KNN talent pooling is disabled by feature flag", 404), false));

export const rankCandidates = async (req: Request, res: Response) => {
  try {
    if (!requireDynamicScoring(res)) return;
    const { jobId } = candidateScoringSchema.rankJobParams.parse(req.params);
    await revalidateJobScoring(jobId);
    return sendSuccess(res, "Job candidate pool re-scoring completed successfully", null, 200);
  } catch (error) { handle(res, error); }
};

export const getRankedCandidates = async (req: Request, res: Response) => {
  try {
    if (!requireDynamicScoring(res)) return;
    const { jobId } = candidateScoringSchema.rankJobParams.parse(req.params);
    const { cursor, limit } = candidateScoringSchema.cursorQuery.parse(req.query);
    sendSuccess(res, "Ranked candidates retrieved", await listRankedCandidates(jobId, cursor, limit));
  } catch (error) { handle(res, error); }
};

export const getTalentPool = async (req: Request, res: Response) => {
  try {
    if (!requireKnnTalentPooling(res)) return;
    const { jobId } = candidateScoringSchema.rankJobParams.parse(req.params);
    const query = candidateScoringSchema.talentPoolQuery.parse(req.query);
    const result = await discoverTalentPoolForJob(jobId, query);
    void logAudit(req.user!.id, "KNN_TALENT_POOL_QUERY", "JobPosting", jobId, {});
    sendSuccess(res, "Talent pool retrieved", result);
  } catch (error) { handle(res, error); }
};

export const getSimilarCandidates = async (req: Request, res: Response) => {
  try {
    if (!requireKnnTalentPooling(res)) return;
    const { jobId: candidateId } = candidateScoringSchema.rankJobParams.parse({ jobId: req.params.candidateId });
    const query = candidateScoringSchema.talentPoolQuery.parse(req.query);
    const result = await findSimilarCandidates(candidateId, query);
    void logAudit(req.user!.id, "KNN_SIMILAR_CANDIDATES_QUERY", "Application", candidateId, {});
    sendSuccess(res, "Similar candidates retrieved", result);
  } catch (error) { handle(res, error); }
};

export const searchTalentPool = async (req: Request, res: Response) => {
  try {
    if (!requireKnnTalentPooling(res)) return;
    const input = candidateScoringSchema.talentPoolSearch.parse(req.body);
    if (input.jobId) {
      const result = await discoverTalentPoolForJob(input.jobId, { k: input.k });
      void logAudit(req.user!.id, "KNN_TALENT_POOL_SEARCH", "JobPosting", input.jobId, {});
      return sendSuccess(res, "Talent pool retrieved", result);
    }
    if (input.candidateId) {
      const result = await findSimilarCandidates(input.candidateId, { k: input.k });
      void logAudit(req.user!.id, "KNN_TALENT_POOL_SEARCH", "Application", input.candidateId, {});
      return sendSuccess(res, "Similar candidates retrieved", result);
    }
    const result = await searchTalentPoolByText(input.text!, { k: input.k });
    void logAudit(req.user!.id, "KNN_TALENT_POOL_SEARCH", "TalentPool", null, {});
    sendSuccess(res, "Talent pool retrieved", result);
  } catch (error) { handle(res, error); }
};

export const addCandidateToPool = async (req: Request, res: Response) => {
  try {
    const input = candidateScoringSchema.addToTalentPool.parse(req.body);
    const result = await addToTalentPool({
      ...input,
      addedById: req.user!.id,
    });
    void logAudit(req.user!.id, "TALENT_POOL_MEMBER_ADDED", "ApplicantProfile", input.applicantProfileId, {});
    sendSuccess(res, "Candidate added to Talent Pool successfully", result, 201);
  } catch (error) { handle(res, error); }
};

export const recordContact = async (req: Request, res: Response) => {
  try {
    const input = candidateScoringSchema.recordContact.parse(req.body);
    const result = await recordTalentPoolContact({
      ...input,
      recruiterId: req.user!.id,
    });
    void logAudit(req.user!.id, "TALENT_POOL_CONTACT_LOGGED", "TalentPoolMembership", input.membershipId, { outcome: input.outcome });
    sendSuccess(res, "Talent pool contact recorded successfully", result, 201);
  } catch (error) { handle(res, error); }
};

export const considerCandidateForJob = async (req: Request, res: Response) => {
  try {
    const input = candidateScoringSchema.considerForJob.parse(req.body);
    const result = await considerTalentPoolCandidateForJob({
      ...input,
      recruiterId: req.user!.id,
    });
    void logAudit(req.user!.id, "TALENT_POOL_REACTIVATION", "Application", result.application.id, { targetJobId: input.targetJobId });
    sendSuccess(res, result.message, result, 201);
  } catch (error) { handle(res, error); }
};


