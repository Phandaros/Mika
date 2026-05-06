import type { Prisma } from "@prisma/client";
import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { emitNotification } from "../lib/socket.js";
import { Priority, TaskStatus, type Priority as PriorityValue, type TaskStatus as TaskStatusValue } from "../lib/enums.js";
import { getAuthUser } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";

interface TaskBody {
  title?: string;
  description?: string | null;
  status?: TaskStatusValue;
  priority?: PriorityValue;
  assigneeId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
}

interface StatusBody {
  status: TaskStatusValue;
}

type NotificationKind = "TASK_ASSIGNED" | "TASK_UPDATED" | "COMMENT_ADDED" | "DUE_SOON";

function dateValue(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value === null ? null : new Date(value);
}

const taskInclude = {
  assignee: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  },
  creator: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  },
  discipline: {
    select: {
      id: true,
      name: true,
      projectId: true
    }
  },
  comments: {
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      }
    },
    orderBy: { createdAt: "asc" as const }
  },
  attachments: true
} satisfies Prisma.TaskInclude;

async function notifyUser(
  userId: string,
  type: NotificationKind,
  title: string,
  message: string,
  taskId: string
): Promise<void> {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      taskId
    }
  });

  emitNotification(userId, notification);
}

export const listTasks: RequestHandler = async (req, res, next) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { disciplineId: req.params.disciplineId },
      orderBy: { updatedAt: "desc" },
      include: taskInclude
    });

    res.json({ tasks });
  } catch (error) {
    next(error);
  }
};

export const getTaskById: RequestHandler = async (req, res, next) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: taskInclude
    });

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    res.json({ task });
  } catch (error) {
    next(error);
  }
};

export const createTask: RequestHandler = async (req, res, next) => {
  try {
    const user = getAuthUser(req);
    const body = req.body as Required<Pick<TaskBody, "title">> & TaskBody;

    const discipline = await prisma.discipline.findUnique({ where: { id: req.params.disciplineId } });

    if (!discipline) {
      throw new AppError(404, "Discipline not found");
    }

    const task = await prisma.task.create({
      data: {
        disciplineId: req.params.disciplineId,
        title: body.title,
        description: body.description,
        status: body.status ?? TaskStatus.BACKLOG,
        priority: body.priority ?? Priority.MEDIUM,
        assigneeId: body.assigneeId,
        creatorId: user.id,
        startDate: dateValue(body.startDate),
        dueDate: dateValue(body.dueDate),
        completedAt: body.status === TaskStatus.DONE ? new Date() : null
      },
      include: taskInclude
    });

    if (task.assigneeId) {
      await notifyUser(
        task.assigneeId,
        "TASK_ASSIGNED",
        "Nova tarefa atribuida",
        `Voce recebeu a tarefa: ${task.title}`,
        task.id
      );
    }

    res.status(201).json({ task });
  } catch (error) {
    next(error);
  }
};

export const updateTask: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as TaskBody;
    const previousTask = await prisma.task.findUnique({ where: { id: req.params.id } });

    if (!previousTask) {
      throw new AppError(404, "Task not found");
    }

    const completedAt =
      body.status === undefined ? undefined : body.status === TaskStatus.DONE ? new Date() : null;

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        title: body.title,
        description: body.description,
        status: body.status,
        priority: body.priority,
        assigneeId: body.assigneeId,
        startDate: dateValue(body.startDate),
        dueDate: dateValue(body.dueDate),
        completedAt
      },
      include: taskInclude
    });

    if (body.assigneeId && body.assigneeId !== previousTask.assigneeId) {
      await notifyUser(
        body.assigneeId,
        "TASK_ASSIGNED",
        "Nova tarefa atribuida",
        `Voce recebeu a tarefa: ${task.title}`,
        task.id
      );
    }

    if (task.assigneeId && body.status && body.status !== previousTask.status) {
      await notifyUser(
        task.assigneeId,
        "TASK_UPDATED",
        "Status de tarefa atualizado",
        `A tarefa ${task.title} foi movida para ${task.status}`,
        task.id
      );
    }

    res.json({ task });
  } catch (error) {
    next(error);
  }
};

export const deleteTask: RequestHandler = async (req, res, next) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const updateTaskStatus: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as StatusBody;
    const previousTask = await prisma.task.findUnique({ where: { id: req.params.id } });

    if (!previousTask) {
      throw new AppError(404, "Task not found");
    }

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        status: body.status,
        completedAt: body.status === TaskStatus.DONE ? new Date() : null
      },
      include: taskInclude
    });

    if (task.assigneeId && body.status !== previousTask.status) {
      await notifyUser(
        task.assigneeId,
        "TASK_UPDATED",
        "Status de tarefa atualizado",
        `A tarefa ${task.title} foi movida para ${task.status}`,
        task.id
      );
    }

    res.json({ task });
  } catch (error) {
    next(error);
  }
};
