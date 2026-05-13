import type { Prisma } from "../generated/prisma/client.js";
import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { Priority, TaskStatus, type Priority as PriorityValue, type TaskStatus as TaskStatusValue } from "../lib/enums.js";
import { makeLocalAsanaGid, taskInclude, toTaskDto } from "../lib/asanaDto.js";
import { AppError } from "../middleware/errorHandler.js";
import { createAndEmitNotification } from "../lib/notify.js";

function sectionIdFromReq(req: { params: Record<string, string | undefined> }): string {
  return req.params.sectionId ?? req.params.disciplineId ?? "";
}

interface TaskBody {
  title?: string;
  description?: string | null;
  status?: TaskStatusValue;
  priority?: PriorityValue;
  assigneeId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  completed?: boolean;
  customFieldValues?: Array<{
    id: string;
    value: string | number | null;
  }>;
}

interface StatusBody {
  status: TaskStatusValue;
}

interface CompletionBody {
  completed: boolean;
}

function dateOnly(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!value) {
    return null;
  }

  return value.slice(0, 10);
}

async function assigneeGid(tx: Prisma.TransactionClient, userId: string | null | undefined): Promise<string | null | undefined> {
  if (userId === undefined) {
    return undefined;
  }

  if (userId === null) {
    return null;
  }

  const user = await tx.user.findUnique({ where: { id: userId }, select: { asanaGid: true } });
  return user?.asanaGid ?? null;
}

export const listTasks: RequestHandler = async (req, res, next) => {
  try {
    const section = await prisma.section.findUnique({
      where: { id: sectionIdFromReq(req) },
      include: {
        memberships: {
          include: {
            task: {
              include: taskInclude
            }
          }
        },
        project: true
      }
    });

    if (!section) {
      throw new AppError(404, "Section not found");
    }

    const tasks = section.memberships
      .filter((membership) => !membership.task.parentId)
      .map((membership) =>
        toTaskDto(membership.task, {
          id: section.id,
          name: section.name,
          projectId: section.project.id
        })
      );

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

    res.json({ task: toTaskDto(task) });
  } catch (error) {
    next(error);
  }
};

export const createTask: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as Required<Pick<TaskBody, "title">> & TaskBody;

    const task = await prisma.$transaction(async (tx) => {
      const section = await tx.section.findUnique({
        where: { id: sectionIdFromReq(req) },
        include: { project: true }
      });

      if (!section) {
        throw new AppError(404, "Section not found");
      }

      const createdTask = await tx.task.create({
        data: {
          asanaGid: makeLocalAsanaGid("task"),
          name: body.title,
          notes: body.description,
          localStatus: body.status ?? TaskStatus.BACKLOG,
          priority: body.priority ?? Priority.MEDIUM,
          assigneeGid: await assigneeGid(tx, body.assigneeId),
          startOn: dateOnly(body.startDate),
          dueOn: dateOnly(body.dueDate),
          completed: body.completed ?? false,
          completedAtAsana: body.completed ? new Date() : null
        }
      });

      await tx.taskMembership.create({
        data: {
          taskId: createdTask.id,
          projectGid: section.projectGid,
          projectName: section.project.name,
          sectionGid: section.asanaGid,
          sectionName: section.name
        }
      });

      return tx.task.findUniqueOrThrow({
        where: { id: createdTask.id },
        include: taskInclude
      });
    });

    if (body.assigneeId) {
      await createAndEmitNotification({
        userId: body.assigneeId,
        type: "TASK_ASSIGNED",
        title: "Nova tarefa atribuida",
        message: task.name,
        taskId: task.id
      });
    }

    res.status(201).json({ task: toTaskDto(task) });
  } catch (error) {
    next(error);
  }
};

export const updateTask: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as TaskBody;

    const existing = await prisma.task.findUnique({
      where: { id: req.params.id },
      select: { assigneeGid: true }
    });

    const task = await prisma.$transaction(async (tx) => {
      const completed = body.completed;

      await tx.task.update({
        where: { id: req.params.id },
        data: {
          name: body.title,
          notes: body.description,
          localStatus: body.status,
          priority: body.priority,
          assigneeGid: await assigneeGid(tx, body.assigneeId),
          startOn: dateOnly(body.startDate),
          dueOn: dateOnly(body.dueDate),
          completed,
          completedAtAsana:
            completed === undefined ? undefined : completed ? new Date() : null
        }
      });

      if (body.customFieldValues) {
        for (const field of body.customFieldValues) {
          const value = field.value;
          const existingRow = await tx.taskCustomFieldValue.findUnique({
            where: { id: field.id },
            include: {
              customField: {
                include: { enumOptions: { where: { enabled: true } } }
              }
            }
          });

          if (typeof value === "number") {
            await tx.taskCustomFieldValue.update({
              where: { id: field.id },
              data: { numberValue: value, displayValue: String(value), enumOptionName: null, enumOptionId: null, enumOptionGid: null }
            });
            continue;
          }

          const str = value === null || value === undefined ? null : String(value);
          if (existingRow?.customField?.enumOptions?.length) {
            const match = existingRow.customField.enumOptions.find(
              (option) => option.name === str || option.asanaGid === str
            );
            if (match) {
              await tx.taskCustomFieldValue.update({
                where: { id: field.id },
                data: {
                  displayValue: match.name,
                  enumOptionName: match.name,
                  enumOptionId: match.id,
                  enumOptionGid: match.asanaGid,
                  enumOptionColor: match.color,
                  numberValue: null
                }
              });
              continue;
            }
          }

          await tx.taskCustomFieldValue.update({
            where: { id: field.id },
            data: { displayValue: str, enumOptionName: str, numberValue: null }
          });
        }
      }

      return tx.task.findUniqueOrThrow({
        where: { id: req.params.id },
        include: taskInclude
      });
    });

    const newGid = task.assignee?.asanaGid ?? null;
    if (body.assigneeId !== undefined && existing?.assigneeGid !== newGid && task.assignee) {
      await createAndEmitNotification({
        userId: task.assignee.id,
        type: "TASK_ASSIGNED",
        title: "Tarefa atribuida a voce",
        message: task.name,
        taskId: task.id
      });
    }

    res.json({ task: toTaskDto(task) });
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
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        localStatus: body.status
      },
      include: taskInclude
    });

    if (task.assignee) {
      await createAndEmitNotification({
        userId: task.assignee.id,
        type: "TASK_UPDATED",
        title: "Status da tarefa",
        message: `${task.name}: ${body.status}`,
        taskId: task.id
      });
    }

    res.json({ task: toTaskDto(task) });
  } catch (error) {
    next(error);
  }
};

export const updateTaskCompletion: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as CompletionBody;
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        completed: body.completed,
        completedAtAsana: body.completed ? new Date() : null
      },
      include: taskInclude
    });

    res.json({ task: toTaskDto(task) });
  } catch (error) {
    next(error);
  }
};
