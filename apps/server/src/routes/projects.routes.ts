import { Router } from "express";
import { z } from "zod";
import {
  createProject,
  deleteProject,
  getProjectById,
  listProjects,
  listWorkloadTasks,
  updateProject
} from "../controllers/projects.controller.js";
import { auth } from "../middleware/auth.js";
import { ProjectStatus, Role } from "../lib/enums.js";
import { requireRole } from "../middleware/role.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();

const projectSchema = z.object({
  name: z.string().min(2),
  description: z.string().nullable().optional(),
  client: z.string().nullable().optional(),
  platform: z.enum(["CAD", "BIM"]).nullable().optional(),
  builder: z.string().nullable().optional(),
  areaM2: z.number().nonnegative().nullable().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  disciplineTypes: z.array(z.string()).optional()
});

const updateProjectSchema = projectSchema.partial();

router.get("/projects", auth, listProjects);
router.get("/projects/:id/workload-tasks", auth, listWorkloadTasks);
router.get("/projects/:id", auth, getProjectById);
router.post("/projects", auth, requireRole(Role.COORDINATOR), validateBody(projectSchema), createProject);
router.patch("/projects/:id", auth, requireRole(Role.COORDINATOR), validateBody(updateProjectSchema), updateProject);
router.delete("/projects/:id", auth, requireRole(Role.ADMIN), deleteProject);

export default router;
