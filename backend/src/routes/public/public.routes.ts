import { Router } from "express";
import { publicLimiter } from "../../middleware/rate-limiter.middleware.js";
import { getPublicTrackingHandler } from "../../controllers/public/public-track.controller.js";
import { getPublicOfferHandler, respondPublicOfferHandler } from "../../controllers/public/public-offer.controller.js";

// No login. Every route here is reached from a printed QR slip or a texted link,
// is rate-limited per IP, and answers 404 for any bad code or token.
const router = Router();

router.use(publicLimiter);

router.get("/track/:code", getPublicTrackingHandler);
// No validate(): the handlers parse themselves so a bad id or token is a 404, not a 400.
router.get("/offers/:id", getPublicOfferHandler);
router.post("/offers/:id/respond", respondPublicOfferHandler);

export default router;
