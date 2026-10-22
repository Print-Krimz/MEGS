import { Router } from "express";
import { publicLimiter, streamFailureLimiter } from "../../middleware/rate-limiter.middleware.js";
import { getPublicTrackingHandler } from "../../controllers/public/public-track.controller.js";
import { streamCheckInHandler, streamTrackingHandler } from "../../controllers/public/public-live.controller.js";
import { getPublicOfferHandler, respondPublicOfferHandler } from "../../controllers/public/public-offer.controller.js";
import {
  getCheckInJobsHandler,
  getCheckInStatusHandler,
  submitCheckInHandler,
} from "../../controllers/public/public-check-in.controller.js";
import { verifyTurnstile } from "../../middleware/turnstile.middleware.js";
import { uploadCheckInBiodata } from "../../middleware/upload.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { checkInSchema } from "../../schemas/check-in.schema.js";

// No login. Every route here is reached from a printed QR slip or a texted link,
// is rate-limited per IP, and answers 404 for any bad code or token.
const router = Router();

// Live streams are mounted before publicLimiter: a stream is one long request, and its automatic
// reconnects would burn the 60/15min budget. They have their own caps (4 per IP, 300 total) and
// need the secret header before any stream opens. streamFailureLimiter counts only failed attempts (30 per 15 min per IP).
router.get("/track/:code/stream", streamFailureLimiter, streamTrackingHandler);
router.get("/check-in/:publicId/stream", streamFailureLimiter, streamCheckInHandler);

router.use(publicLimiter);

router.get("/track/:code", getPublicTrackingHandler);
// No validate(): the handlers parse themselves so a bad id or token is a 404, not a 400.
router.get("/offers/:id", getPublicOfferHandler);
router.post("/offers/:id/respond", respondPublicOfferHandler);

// Self check-in from the MEGS poster QR. Submitting returns 400 with field errors; the status link answers 404 when wrong.
router.get("/check-in/jobs", getCheckInJobsHandler);
// Multipart with an optional biodata "file". Turnstile reads the x-turnstile-token header, so it runs before the upload is buffered.
router.post("/check-in", verifyTurnstile, uploadCheckInBiodata.single("file"), validate(checkInSchema.submit), submitCheckInHandler);
router.get("/check-in/:publicId", getCheckInStatusHandler);

export default router;
