import { Router } from "express";
import { z } from "zod";
import {
  createTask,
  deleteTask,
  getTaskById,
  listTasks,
  updateTask,
  updateTaskCompletion,
  updateTaskStatus
} from "../controllers/tasks.controller.js";
import { auth } from "../middleware/auth.js";
import { Priority, TaskStatus } from "../lib/enums.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();
const persistedTaskStatusSchema = z.nativeEnum(TaskStatus).refine((status) => status !== TaskStatus.OVERDUE, {
  message: "Status atrasado e calculado automaticamente"
});

const taskSchema = z.object({
  title: z.string().min(2),
  description: z.string().nullable().optional(),
  status: persistedTaskStatusSchema.optional(),
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
  customFieldValues: z.array(z.object({
    id: z.string().optional(),
    mikaKey: z.string().optional(),
    value: z.union([z.string(), z.number()]).nullable()
  })).optional()
});

const taskStatusSchema = z.object({
  status: persistedTaskStatusSchema
});

const taskCompletionSchema = z.object({
  completed: z.boolean()
});

router.use(auth);
router.get("/sections/:sectionId/tasks", listTasks);
router.get("/disciplines/:disciplineId/tasks", listTasks);
router.get("/tasks/:id", getTaskById);
router.post("/sections/:sectionId/tasks", validateBody(createTaskSchema), createTask);
router.post("/disciplines/:disciplineId/tasks", validateBody(createTaskSchema), createTask);
router.patch("/tasks/:id", validateBody(updateTaskSchema), updateTask);
router.delete("/tasks/:id", deleteTask);
router.patch("/tasks/:id/status", validateBody(taskStatusSchema), updateTaskStatus);
router.patch("/tasks/:id/completed", validateBody(taskCompletionSchema), updateTaskCompletion);

export default router;
