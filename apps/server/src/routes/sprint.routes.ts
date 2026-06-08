import { Router } from "express";
import { getSprintSummary, listSprintTasks } from "../controllers/sprint.controller.js";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { Role } from "../lib/enums.js";

const router = Router();

router.get("/sprint/summary", auth, requireRole(Role.COORDINATOR), getSprintSummary);
router.get("/sprint/tasks", auth, requireRole(Role.COORDINATOR), listSprintTasks);

export default router;
