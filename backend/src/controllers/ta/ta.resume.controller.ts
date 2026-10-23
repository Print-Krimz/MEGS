import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import {
  applyMergeDecision,
  findProfileIdByCandidateId,
  getLatestProposal,
  ResumeMergeError,
} from "../../services/applicant/resume-merge.service.js";

const candidateIdOf = (req: Request): string => {
  const raw = req.params.id;
  return (Array.isArray(raw) ? raw[0] : raw) ?? "";
};

// Latest unreviewed resume proposal for a candidate the TA owns (null when there is none).
export const getCandidateResumeProposalHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const profileId = await findProfileIdByCandidateId(candidateIdOf(req));
    if (!profileId) { sendError(res, "Candidate not found", 404); return; }
    sendSuccess(res, "Resume proposal retrieved", await getLatestProposal(profileId));
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
