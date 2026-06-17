import { Router } from "express";
import { z } from "zod";
import {
  createTask,
  deleteTask,
  getTaskById,
  listTaskHistory,
  listMyTasks,
  sendTaskToReview,
  listTasks,
  updateTask,
  updateTaskCompletion,
  updateTaskStatus
} from "../controllers/tasks.controller.js";
import { auth } from "../middleware/auth.js";
import { Priority, Role, TaskStatus } from "../lib/enums.js";
import { requireRole } from "../middleware/role.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();
const taskStatusCommandSchema = z.nativeEnum(TaskStatus);

const taskSchema = z.object({
  title: z.string().min(2),
  description: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  sectionId: z.string().nullable().optional(),
  status: taskStatusCommandSchema.optional(),
  priority: z.nativeEnum(Priority).optional(),
  assigneeId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedDays: z.number().nonnegative().nullable().optional(),
  platform: z.string().trim().nullable().optional(),
  discipline: z.string().trim().nullable().optional(),
  taskDiscipline: z.string().trim().nullable().optional(),
  estimatedTime: z.number().nonnegative().nullable().optional(),
  maxDeadline: z.string().nullable().optional(),
  conclusionDays: z.number().nonnegative().nullable().optional(),
  stage: z.string().trim().nullable().optional()
});

const createTaskSchema = taskSchema.extend({
  customFieldValues: z.array(z.object({
    settingId: z.string().optional(),
    mikaKey: z.string().optional(),
    value: z.union([z.string(), z.number()]).nullable()
  })).optional()
});

const updateTaskSchema = taskSchema.partial().extend({
  projectIds: z.array(z.string()).min(1).optional(),
  projectMemberships: z.array(z.object({
    projectId: z.string(),
    sectionId: z.string()
  })).optional(),
  customFieldValues: z.array(z.object({
    id: z.string().optional(),
    mikaKey: z.string().optional(),
    value: z.union([z.string(), z.number()]).nullable()
  })).optional()
});

const taskStatusSchema = z.object({
  status: taskStatusCommandSchema
});

const taskCompletionSchema = z.object({
  completed: z.boolean()
});

const sendTaskToReviewSchema = z.object({
  reviewerId: z.string()
});

router.get("/sections/:sectionId/tasks", auth, listTasks);
router.get("/disciplines/:disciplineId/tasks", auth, listTasks);
router.get("/tasks/mine", auth, listMyTasks);
router.get("/tasks/:id", auth, getTaskById);
router.get("/tasks/:id/history", auth, requireRole(Role.COORDINATOR), listTaskHistory);
router.post("/tasks", auth, requireRole(Role.COORDINATOR), validateBody(createTaskSchema), createTask);
router.post("/sections/:sectionId/tasks", auth, requireRole(Role.COORDINATOR), validateBody(createTaskSchema), createTask);
router.post("/disciplines/:disciplineId/tasks", auth, requireRole(Role.COORDINATOR), validateBody(createTaskSchema), createTask);
router.patch("/tasks/:id", auth, requireRole(Role.COORDINATOR), validateBody(updateTaskSchema), updateTask);
router.delete("/tasks/:id", auth, requireRole(Role.COORDINATOR), deleteTask);
router.post("/tasks/:id/send-to-review", auth, requireRole(Role.COORDINATOR), validateBody(sendTaskToReviewSchema), sendTaskToReview);
router.patch("/tasks/:id/status", auth, requireRole(Role.COORDINATOR), validateBody(taskStatusSchema), updateTaskStatus);
router.patch("/tasks/:id/completed", auth, requireRole(Role.DESIGNER), validateBody(taskCompletionSchema), updateTaskCompletion);

export default router;
