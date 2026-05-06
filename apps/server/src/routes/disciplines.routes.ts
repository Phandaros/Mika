import { Router } from "express";
import { z } from "zod";
import {
  createDiscipline,
  deleteDiscipline,
  listDisciplines,
  updateDiscipline
} from "../controllers/disciplines.controller.js";
import { auth } from "../middleware/auth.js";
import { DisciplineStatus, DisciplineType, Role } from "../lib/enums.js";
import { requireRole } from "../middleware/role.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();

const disciplineSchema = z.object({
  name: z.string().min(2),
  type: z.nativeEnum(DisciplineType),
  status: z.nativeEnum(DisciplineStatus).optional(),
  responsibleId: z.string().nullable().optional()
});

const updateDisciplineSchema = disciplineSchema.partial();

router.use(auth);
router.get("/projects/:projectId/disciplines", listDisciplines);
router.post(
  "/projects/:projectId/disciplines",
  requireRole(Role.COORDINATOR),
  validateBody(disciplineSchema),
  createDiscipline
);
router.patch("/disciplines/:id", validateBody(updateDisciplineSchema), updateDiscipline);
router.delete("/disciplines/:id", requireRole(Role.COORDINATOR), deleteDiscipline);

export default router;
