import { Router } from "express";
import { getHomeDashboard, listRecentActivity } from "../controllers/activity.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.get("/activity/home", auth, getHomeDashboard);
router.get("/activity/recent", auth, listRecentActivity);

export default router;
