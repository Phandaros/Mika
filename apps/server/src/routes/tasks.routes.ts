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

const taskSchema = z.object({
  title: z.string().min(2),
  description: z.string().nullable().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  assigneeId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  completed: z.boolean().optional(),
  customFieldValues: z.array(z.object({
    id: z.string(),
    value: z.union([z.string(), z.number()]).nullable()
  })).optional()
});

const updateTaskSchema = taskSchema.partial();

const taskStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus)
});

const taskCompletionSchema = z.object({
  completed: z.boolean()
});

router.use(auth);
router.get("/sections/:sectionId/tasks", listTasks);
router.get("/disciplines/:disciplineId/tasks", listTasks);
router.get("/tasks/:id", getTaskById);
router.post("/sections/:sectionId/tasks", validateBody(taskSchema), createTask);
router.post("/disciplines/:disciplineId/tasks", validateBody(taskSchema), createTask);
router.patch("/tasks/:id", validateBody(updateTaskSchema), updateTask);
router.delete("/tasks/:id", deleteTask);
router.patch("/tasks/:id/status", validateBody(taskStatusSchema), updateTaskStatus);
router.patch("/tasks/:id/completed", validateBody(taskCompletionSchema), updateTaskCompletion);

export default router;
