import { Router } from "express";
import { getIndicators } from "../controllers/indicators.controller.js";
import { Role } from "../lib/enums.js";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";

const router = Router();

router.get("/indicators", auth, requireRole(Role.COORDINATOR), getIndicators);

export default router;
