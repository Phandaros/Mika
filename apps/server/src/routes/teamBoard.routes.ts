import { Router } from "express";
import { getTeamBoard } from "../controllers/teamBoard.controller.js";
import { Role } from "../lib/enums.js";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";

const router = Router();

router.get("/team-board", auth, requireRole(Role.COORDINATOR), getTeamBoard);

export default router;
