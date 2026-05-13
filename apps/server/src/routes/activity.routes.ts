import { Router } from "express";
import { listRecentActivity } from "../controllers/activity.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.use(auth);
router.get("/activity/recent", listRecentActivity);

export default router;
