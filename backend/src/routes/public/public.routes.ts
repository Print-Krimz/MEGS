import { Router } from "express";
import { publicLimiter } from "../../middleware/rate-limiter.middleware.js";
import { getPublicTrackingHandler } from "../../controllers/public/public-track.controller.js";
import { getPublicOfferHandler, respondPublicOfferHandler } from "../../controllers/public/public-offer.controller.js";
import {
  getCheckInJobsHandler,
  getCheckInStatusHandler,
  submitCheckInHandler,
} from "../../controllers/public/public-check-in.controller.js";
import { verifyTurnstile } from "../../middleware/turnstile.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { checkInSchema } from "../../schemas/check-in.schema.js";

// No login. Every route here is reached from a printed QR slip or a texted link,
// is rate-limited per IP, and answers 404 for any bad code or token.
const router = Router();

router.use(publicLimiter);

router.get("/track/:code", getPublicTrackingHandler);
// No validate(): the handlers parse themselves so a bad id or token is a 404, not a 400.
router.get("/offers/:id", getPublicOfferHandler);
router.post("/offers/:id/respond", respondPublicOfferHandler);

// Self check-in from the MEGS poster QR. Submitting returns 400 with field errors; the status link answers 404 when wrong.
router.get("/check-in/jobs", getCheckInJobsHandler);
router.post("/check-in", verifyTurnstile, validate(checkInSchema.submit), submitCheckInHandler);
router.get("/check-in/:publicId", getCheckInStatusHandler);

export default router;
