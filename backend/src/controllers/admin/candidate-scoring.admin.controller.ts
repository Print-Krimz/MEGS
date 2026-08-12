import type { Request, Response } from "express";
import { ZodError } from "zod";

import { candidateScoringSchema } from '../../schemas/candidate-scoring.schema.js';
import {
  ConcurrentModificationError,
  getActiveScoringConfiguration,
  InvalidScoringConfigurationError,
  listScoringConfigurationHistory,
  restoreDefaultScoringConfiguration,
  updateScoringConfiguration,
  validateConfigurationChange,
} from "../../services/scoring/scoring-configuration.service.js";
import { getScoringRevalidationStatus } from "../../services/scoring/scoring-configuration.service.js";
import { getScoringQualityMetrics } from "../../services/scoring/scoring-quality.service.js";
import { sendError, sendSuccess } from '../../utils/response.js';

const invalid = (res: Response, errors: Array<{ field: string; code: string; message: string }>) =>
  res.status(422).json({ success: false, message: "Invalid candidate scoring configuration", code: "INVALID_CONFIGURATION", errors });

const handle = (res: Response, error: unknown) => {
  if (error instanceof InvalidScoringConfigurationError) return invalid(res, error.errors);
  if (error instanceof ConcurrentModificationError) return res.status(409).json({ success: false, message: error.message, code: "CONCURRENT_MODIFICATION" });
  if (error instanceof ZodError) return invalid(res, error.issues.map((issue) => ({ field: issue.path.join("."), code: "INVALID_VALUE", message: issue.message })));
  return sendError(res, error instanceof Error ? error.message : "Unable to process candidate scoring request", 500);
};

export const getConfiguration = async (_req: Request, res: Response) => {
  try { sendSuccess(res, "Candidate scoring configuration retrieved", await getActiveScoringConfiguration()); } catch (error) { handle(res, error); }
};

export const validateConfiguration = async (req: Request, res: Response) => {
  try {
    const input = candidateScoringSchema.validateConfiguration.parse(req.body);
    sendSuccess(res, "Candidate scoring configuration is valid", validateConfigurationChange(input));
  } catch (error) { handle(res, error); }
};

export const updateConfiguration = async (req: Request, res: Response) => {
  try {
    const input = candidateScoringSchema.configuration.parse(req.body);
    sendSuccess(res, "Candidate scoring configuration activated", await updateScoringConfiguration(req.user!.id, input.expectedRevision, input), 201);
  } catch (error) { handle(res, error); }
};

export const restoreDefaults = async (req: Request, res: Response) => {
  try {
    const input = candidateScoringSchema.restoreDefaults.parse(req.body);
    sendSuccess(res, "Default candidate scoring configuration activated", await restoreDefaultScoringConfiguration(req.user!.id, input.expectedRevision), 201);
  } catch (error) { handle(res, error); }
};

export const getConfigurationHistory = async (req: Request, res: Response) => {
  try {
    const { cursor, limit } = candidateScoringSchema.cursorQuery.parse(req.query);
    sendSuccess(res, "Candidate scoring configuration history retrieved", await listScoringConfigurationHistory(cursor, limit));
  } catch (error) { handle(res, error); }
};

export const getRevalidationStatus = async (_req: Request, res: Response) => {
  try { sendSuccess(res, "Candidate scoring revalidation status retrieved", await getScoringRevalidationStatus()); } catch (error) { handle(res, error); }
};

export const getQualityMetrics = async (_req: Request, res: Response) => {
  try { sendSuccess(res, "Candidate scoring quality metrics retrieved", await getScoringQualityMetrics()); } catch (error) { handle(res, error); }
};

