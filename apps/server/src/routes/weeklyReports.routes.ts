import { Router } from "express";
import {
  downloadMonthlyCompletedTemplate,
  getMyHistory,
  getMyReport,
  getReport,
  listReports,
  submitReport,
  updateItem
} from "../controllers/weeklyReports.controller.js";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { validateBody } from "../middleware/validate.js";
import { Role } from "../lib/enums.js";
import { z } from "zod";

const router = Router();

const updateItemBodySchema = z.object({
  comment: z.string().max(2000)
});

router.get("/weekly-reports/mine", auth, getMyReport);
router.get("/weekly-reports/mine/history", auth, getMyHistory);
router.get("/weekly-reports", auth, requireRole(Role.COORDINATOR), listReports);
router.get(
  "/weekly-reports/monthly-completed-template",
  auth,
  requireRole(Role.COORDINATOR),
  downloadMonthlyCompletedTemplate
);
router.get("/weekly-reports/:id", auth, getReport);
router.patch(
  "/weekly-reports/:id/items/:itemId",
  auth,
  validateBody(updateItemBodySchema),
  updateItem
);
router.post("/weekly-reports/:id/submit", auth, submitReport);

export default router;
