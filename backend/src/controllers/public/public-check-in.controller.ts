import type { Request, Response } from "express";
import { sendError, sendSuccess } from "../../utils/response.js";
import { createCheckIn, getCheckInStatus, listCheckInJobs, CheckInInputError } from "../../services/ta/walk-in-check-in.service.js";

const noStore = (res: Response) => res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });

// GET /api/public/check-in/jobs?q= - open jobs only. No validate(): a bad query is just an empty search.
export const getCheckInJobsHandler = async (req: Request, res: Response): Promise<void> => {
  noStore(res);
  try {
    const q = typeof req.query.q === "string" ? req.query.q.slice(0, 80) : undefined;
    sendSuccess(res, "Jobs retrieved", await listCheckInJobs(q));
  } catch {
    sendError(res, "Jobs are not available right now", 404);
  }
};

// POST /api/public/check-in (multipart; behind verifyTurnstile, the optional biodata upload and validate(checkInSchema.submit)). Validation failures are 400.
export const submitCheckInHandler = async (req: Request, res: Response): Promise<void> => {
  noStore(res);
  try {
    const body = req.body;
    const result = await createCheckIn(
      {
        jobPostingId: Number(body.jobPostingId),
        firstName: body.firstName,
        middleName: body.middleName || null,
        lastName: body.lastName,
        mobileNumber: body.mobileNumber || null,
        birthDate: body.birthDate,
      },
      req.file,
    );
    if (result.alreadyCheckedIn) {
      // No link is reissued: the original phone keeps the only view token.
      sendSuccess(res, "Already checked in", { alreadyCheckedIn: true, queueNumber: result.queueNumber }, 200);
      return;
    }
    const { alreadyCheckedIn: _flag, ...created } = result;
    sendSuccess(res, "Checked in", created, 201);
  } catch (error: any) {
    // Business failures (closed job, bad mobile) are the applicant's to fix; anything else is a server fault.
    const known = error instanceof CheckInInputError;
    sendError(res, known ? error.message : "Check-in failed. Please try again.", known ? 400 : 500, error);
  }
};

// GET /api/public/check-in/:publicId?token= - every failure is a 404 so a bad link never says which part was wrong.
export const getCheckInStatusHandler = async (req: Request, res: Response): Promise<void> => {
  noStore(res);
  try {
    const publicId = String(req.params.publicId ?? "");
    const token = typeof req.query.token === "string" ? req.query.token : "";
    const status = await getCheckInStatus(publicId, token);
    if (!status) {
      sendError(res, "This link no longer works", 404);
      return;
    }
    sendSuccess(res, "Check-in retrieved", status);
  } catch {
    sendError(res, "This link no longer works", 404);
  }
};
