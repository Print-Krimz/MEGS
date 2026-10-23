import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import {
  applyMergeDecision,
  findProfileIdByCandidateId,
  ResumeMergeError,
} from "../../services/applicant/resume-merge.service.js";
import { getResumeReviewState, reparseCandidateResume } from "../../services/ta/ta.resume-reparse.service.js";

const candidateIdOf = (req: Request): string => {
  const raw = req.params.id;
  return (Array.isArray(raw) ? raw[0] : raw) ?? "";
};

// Latest unreviewed resume proposal (null when none) and the state of the latest parse, for a candidate the TA owns.
export const getCandidateResumeProposalHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const profileId = await findProfileIdByCandidateId(candidateIdOf(req));
    if (!profileId) { sendError(res, "Candidate not found", 404); return; }
    sendSuccess(res, "Resume proposal retrieved", await getResumeReviewState(profileId));
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const applyCandidateResumeMergeHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const profileId = await findProfileIdByCandidateId(candidateIdOf(req));
    if (!profileId) { sendError(res, "Candidate not found", 404); return; }
    const result = await applyMergeDecision({
      parseId: Number(req.params.parseId),
      profileId,
      actor: { userId: req.user!.id, role: req.user!.role },
      accept: req.body.accept,
    });
    sendSuccess(res, "Resume details saved", result);
  } catch (error: any) {
    sendError(res, error.message, error instanceof ResumeMergeError ? error.status : 500);
  }
};

// Reads the candidate's resume again. The result waits for review; nothing is applied here.
export const reparseCandidateResumeHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const state = await reparseCandidateResume({
      candidateId: candidateIdOf(req),
      documentId: req.body?.documentId,
      actorUserId: req.user!.id,
    });
    sendSuccess(res, "Resume read", state);
  } catch (error: any) {
    sendError(res, error.message, error instanceof ResumeMergeError ? error.status : 500);
  }
};
