import { Router } from "express";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "../controllers/notifications.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.get("/notifications", auth, listNotifications);
router.patch("/notifications/read-all", auth, markAllNotificationsRead);
router.patch("/notifications/:id/read", auth, markNotificationRead);

export default router;
