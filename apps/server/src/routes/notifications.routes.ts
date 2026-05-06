import { Router } from "express";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "../controllers/notifications.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.use(auth);
router.get("/notifications", listNotifications);
router.patch("/notifications/read-all", markAllNotificationsRead);
router.patch("/notifications/:id/read", markNotificationRead);

export default router;
