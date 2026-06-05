import { Router } from "express";
import { listRecentActivity } from "../controllers/activity.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.get("/activity/recent", auth, listRecentActivity);

export default router;
