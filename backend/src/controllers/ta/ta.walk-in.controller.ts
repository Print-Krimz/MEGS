import type { Request, Response } from "express";
import { sendError, sendSuccess } from "../../utils/response.js";
import {
  WalkInConflictError,
  createWalkIn,
  findWalkInDuplicates,
  reissueSlip,
} from "../../services/ta/walk-in.service.js";

const statusFor = (error: any): number => {
  if (error instanceof WalkInConflictError) return 409;
  return String(error?.message ?? "").includes("not found") ? 404 : 400;
};

// GET /api/ta/walk-ins/check-duplicate
export const checkWalkInDuplicateHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, firstName, lastName, birthDate } = req.query as Record<string, string | undefined>;
    sendSuccess(res, "Duplicate check complete", await findWalkInDuplicates({ phone, firstName, lastName, birthDate }));
  } catch (error: any) {
    sendError(res, error.message, statusFor(error), error);
  }
};

// POST /api/ta/walk-ins (multipart, file field "file")
export const createWalkInHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      sendError(res, "Attach the biodata photo or PDF", 400);
      return;
    }
    const body = req.body;
    const slip = await createWalkIn(
      req.user!,
      {
        jobPostingId: Number(body.jobPostingId),
        source: "WALK_IN",
        firstName: body.firstName,
        middleName: body.middleName || null,
        lastName: body.lastName,
        mobileNumber: body.mobileNumber || null,
        birthDate: body.birthDate || null,
        existingUserId: body.existingUserId || null,
      },
      req.file,
    );
    sendSuccess(res, "Walk-in encoded", slip, 201);
  } catch (error: any) {
    sendError(res, error.message, statusFor(error), error);
  }
};

// POST /api/ta/walk-ins/:id/slip
export const reissueWalkInSlipHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    sendSuccess(res, "Slip reissued", await reissueSlip(req.user!, id));
  } catch (error: any) {
    sendError(res, error.message, statusFor(error), error);
  }
};
