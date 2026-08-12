import { Router } from "express";
import { authenticateJWT } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { notificationSchema } from '../../schemas/notification.schema.js';

import {
  streamNotifications,
  listNotifications,
  getUnreadCount,
  markAsRead,
} from '../../controllers/core/notification.controller.js';

const router = Router();

router.use(authenticateJWT);

router.get("/stream", streamNotifications);
router.get("/", validate(notificationSchema.listNotifications), listNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/:id/read", validate(notificationSchema.markAsRead), markAsRead);

export default router;
