import type { Request, Response } from "express";
import { sendError, sendSuccess } from "../../utils/response.js";
import { publicMessages } from "../../security/public-messages.js";
import { WalkInConflictError } from "../../services/ta/walk-in.service.js";
import {
  confirmCheckIn,
  dismissCheckIn,
  getPendingBiodata,
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

// POST /api/ta/walk-ins/check-ins/:id/confirm (multipart, optional file field "file"; without it the applicant's own upload is used)
export const confirmCheckInHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseId(req);
    if (isNaN(id)) {
      sendError(res, "Check-in not found", 404);
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

// GET /api/ta/walk-ins/check-ins/:id/biodata - streams the file the applicant attached; 404 once the check-in is no longer pending.
export const getCheckInBiodataHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseId(req);
    if (isNaN(id)) {
      sendError(res, "Biodata not found", 404);
      return;
    }
    let file: Awaited<ReturnType<typeof getPendingBiodata>>;
    try {
      file = await getPendingBiodata(id);
    } catch (error: any) {
      // Unknown or closed check-in: 404. A storage failure is a server fault, not something the TA can fix here.
      const notFound = /not found/i.test(String(error?.message ?? ""));
      sendError(res, notFound ? "Biodata not found" : "Could not load the file. Try again.", notFound ? 404 : 500, error);
      return;
    }
    const plain = file.fileName.replace(/[^ -~]|["\\;]/g, "_");
    res
      .status(200)
      .set({
        "Content-Type": file.mimeType,
        "Content-Length": String(file.buffer.length),
        "Content-Disposition": `inline; filename="${plain}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      })
      .send(file.buffer);
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
