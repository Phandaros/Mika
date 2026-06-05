import { Router } from "express";
import { z } from "zod";
import {
  createSection,
  deleteSection,
  listSections,
  updateSection
} from "../controllers/sections.controller.js";
import { auth } from "../middleware/auth.js";
import { DisciplineStatus, DisciplineType, Role } from "../lib/enums.js";
import { requireRole } from "../middleware/role.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();

const sectionSchema = z.object({
  name: z.string().min(2),
  type: z.nativeEnum(DisciplineType),
  status: z.nativeEnum(DisciplineStatus).optional(),
  responsibleId: z.string().nullable().optional()
});

const updateSectionSchema = sectionSchema.partial();

router.get("/projects/:projectId/sections", auth, listSections);
router.get("/projects/:projectId/disciplines", auth, listSections);

router.post(
  "/projects/:projectId/sections",
  auth,
  requireRole(Role.COORDINATOR),
  validateBody(sectionSchema),
  createSection
);
router.post(
  "/projects/:projectId/disciplines",
  auth,
  requireRole(Role.COORDINATOR),
  validateBody(sectionSchema),
  createSection
);

router.patch("/sections/:id", auth, validateBody(updateSectionSchema), updateSection);
router.patch("/disciplines/:id", auth, validateBody(updateSectionSchema), updateSection);

router.delete("/sections/:id", auth, requireRole(Role.COORDINATOR), deleteSection);
router.delete("/disciplines/:id", auth, requireRole(Role.COORDINATOR), deleteSection);

export default router;
