import type { Request, Response } from "express";
import { sendError, sendSuccess } from "../../utils/response.js";
import { publicMessages } from "../../security/public-messages.js";
import { WalkInConflictError } from "../../services/ta/walk-in.service.js";
import {
  confirmCheckIn,
  dismissCheckIn,
  getPendingCheckIn,
  listPendingCheckIns,
} from "../../services/ta/walk-in-check-in.service.js";

const statusFor = (error: any): number => {
  if (error instanceof WalkInConflictError) return 409;
  if (String(error?.message ?? "").includes("not found")) return 404;
  // Known intake failures are the TA's to fix; anything else is a server fault.
  const message = String(error?.message ?? "");
  return publicMessages.has(message) || message.startsWith("You are currently deployed") ? 400 : 500;
};

const parseId = (req: Request): number => parseInt(String(req.params.id ?? ""), 10);

// GET /api/ta/walk-ins/check-ins
export const listCheckInsHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    sendSuccess(res, "Check-ins retrieved", await listPendingCheckIns());
  } catch (error: any) {
    sendError(res, error.message, statusFor(error), error);
  }
};

// GET /api/ta/walk-ins/check-ins/:id
export const getCheckInHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseId(req);
    if (isNaN(id)) {
      sendError(res, "Check-in not found", 404);
      return;
    }
    sendSuccess(res, "Check-in retrieved", await getPendingCheckIn(id));
  } catch (error: any) {
    sendError(res, error.message, statusFor(error), error);
  }
};

// POST /api/ta/walk-ins/check-ins/:id/confirm (multipart, file field "file")
export const confirmCheckInHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseId(req);
    if (isNaN(id)) {
      sendError(res, "Check-in not found", 404);
      return;
    }
    if (!req.file) {
      sendError(res, "Attach the biodata photo or PDF", 400);
      return;
    }
    const body = req.body;
    const slip = await confirmCheckIn(
      req.user!,
      id,
      {
        firstName: body.firstName,
        middleName: body.middleName || null,
        lastName: body.lastName,
        mobileNumber: body.mobileNumber || null,
        birthDate: body.birthDate,
        existingUserId: body.existingUserId || null,
      },
      req.file,
    );
    sendSuccess(res, "Check-in confirmed", slip, 201);
  } catch (error: any) {
    sendError(res, error.message, statusFor(error), error);
  }
};

// POST /api/ta/walk-ins/check-ins/:id/dismiss
export const dismissCheckInHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseId(req);
    if (isNaN(id)) {
      sendError(res, "Check-in not found", 404);
      return;
    }
    sendSuccess(res, "Check-in dismissed", await dismissCheckIn(req.user!, id, String(req.body.reason ?? "")));
  } catch (error: any) {
    sendError(res, error.message, statusFor(error), error);
  }
};
