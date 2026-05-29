import type { Prisma } from "../generated/prisma/client.js";
import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { Priority, TaskStatus, type Priority as PriorityValue, type TaskStatus as TaskStatusValue } from "../lib/enums.js";
import { makeLocalAsanaGid, normalizePersistedTaskStatus, taskCustomFieldCatalogInclude, taskInclude, toTaskDto } from "../lib/asanaDto.js";
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
  estimatedDays?: number | null;
  platform?: string | null;
  discipline?: string | null;
  taskDiscipline?: string | null;
  estimatedTime?: number | null;
  maxDeadline?: string | null;
  conclusionDays?: number | null;
  stage?: string | null;
  customFieldValues?: Array<{
    id?: string;
    settingId?: string;
    mikaKey?: string;
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

const completingTaskStatuses = new Set<TaskStatusValue>([TaskStatus.IN_ANALYSIS, TaskStatus.AWAITING_REVIEW, TaskStatus.FINISHED]);

function taskStatusCompletes(status: TaskStatusValue): boolean {
  return completingTaskStatuses.has(status);
}

function completionDateForStatus(status: TaskStatusValue, currentCompletedAt?: Date | null): Date | null {
  return taskStatusCompletes(status) ? currentCompletedAt ?? new Date() : null;
}

function writableStatus(value: TaskStatusValue | string | null | undefined): TaskStatusValue {
  const normalized = normalizePersistedTaskStatus(value) as TaskStatusValue | null;
  return normalized ?? TaskStatus.TODO;
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

function normalizedCustomFieldString(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const str = String(value).trim();
  return str || null;
}

const customFieldValueInclude = {
  customField: {
    include: { enumOptions: { where: { enabled: true } } }
  }
} satisfies Prisma.TaskCustomFieldValueInclude;

type CustomFieldValueRow = Prisma.TaskCustomFieldValueGetPayload<{ include: typeof customFieldValueInclude }>;

function numericCustomFieldValue(fieldType: string, value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }

  if (fieldType !== "number" && fieldType !== "integer") {
    return null;
  }

  const parsed = Number(value.replace(",", "."));
  return Number.isNaN(parsed) ? null : parsed;
}

async function applyCustomFieldValue(tx: Prisma.TransactionClient, row: CustomFieldValueRow, value: string | number | null): Promise<void> {
  if (value === null || value === undefined || value === "") {
    await tx.taskCustomFieldValue.update({
      where: { id: row.id },
      data: {
        displayValue: null,
        enumOptionName: null,
        enumOptionId: null,
        enumOptionGid: null,
        enumOptionColor: null,
        numberValue: null
      }
    });
    return;
  }

  if (typeof value === "number") {
    await tx.taskCustomFieldValue.update({
      where: { id: row.id },
      data: { numberValue: value, displayValue: String(value), enumOptionName: null, enumOptionId: null, enumOptionGid: null }
    });
    return;
  }

  const str = String(value).trim();
  const match = row.customField?.enumOptions.find((option) => option.name === str || option.asanaGid === str);

  if (match) {
    await tx.taskCustomFieldValue.update({
      where: { id: row.id },
      data: {
        displayValue: match.name,
        enumOptionName: match.name,
        enumOptionId: match.id,
        enumOptionGid: match.asanaGid,
        enumOptionColor: match.color,
        numberValue: null
      }
    });
    return;
  }

  const numberValue = numericCustomFieldValue(row.customField?.type ?? row.type, str);

  await tx.taskCustomFieldValue.update({
    where: { id: row.id },
    data: {
      displayValue: str || null,
      enumOptionName: row.customField?.enumOptions.length ? null : str || null,
      enumOptionId: null,
      enumOptionGid: null,
      enumOptionColor: null,
      numberValue
    }
  });
}

async function upsertMikaCustomFieldValue(
  tx: Prisma.TransactionClient,
  taskId: string,
  mikaKey: string,
  value: string | number | null
): Promise<void> {
  const stringValue = normalizedCustomFieldString(value);

  if (stringValue === null) {
    const rows = await tx.taskCustomFieldValue.findMany({
      where: { taskId, customField: { mikaKey, mikaTaskField: true } },
      include: customFieldValueInclude
    });

    for (const row of rows) {
      await applyCustomFieldValue(tx, row, null);
    }
    return;
  }

  const fields = await tx.asanaCustomField.findMany({
    where: { mikaKey, mikaTaskField: true },
    include: { enumOptions: { where: { enabled: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
    orderBy: [{ mikaSortOrder: "asc" }, { name: "asc" }]
  });

  const customField =
    fields.find((field) => field.enumOptions.some((option) => option.name === stringValue || option.asanaGid === stringValue)) ??
    fields[0];

  if (!customField) {
    return;
  }

  const existingRow = await tx.taskCustomFieldValue.findUnique({
    where: { taskId_customFieldGid: { taskId, customFieldGid: customField.asanaGid } },
    include: customFieldValueInclude
  });

  if (existingRow) {
    await applyCustomFieldValue(tx, existingRow, value);
    return;
  }

  const enumMatch = customField.enumOptions.find((option) => option.name === stringValue || option.asanaGid === stringValue);
  const numberValue = numericCustomFieldValue(customField.type, value);

  await tx.taskCustomFieldValue.create({
    data: {
      taskId,
      customFieldGid: customField.asanaGid,
      customFieldName: customField.mikaLabel ?? customField.name,
      type: customField.type,
      precision: customField.precision,
      displayValue: enumMatch?.name ?? stringValue,
      numberValue,
      enumOptionName: enumMatch?.name ?? null,
      enumOptionId: enumMatch?.id ?? null,
      enumOptionGid: enumMatch?.asanaGid ?? null,
      enumOptionColor: enumMatch?.color ?? null,
      customFieldId: customField.id
    }
  });
}

async function taskFieldCatalog() {
  return prisma.asanaCustomField.findMany({
    where: { mikaTaskField: true },
    include: taskCustomFieldCatalogInclude,
    orderBy: [{ mikaSortOrder: "asc" }, { name: "asc" }]
  });
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

    const catalog = await taskFieldCatalog();
    const tasks = section.memberships
      .filter((membership) => !membership.task.parentId)
      .map((membership) =>
        toTaskDto(membership.task, {
          id: section.id,
          name: section.name,
          projectId: section.project.id
        }, catalog)
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

    const catalog = await taskFieldCatalog();

    res.json({ task: toTaskDto(task, undefined, catalog) });
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

      const status = writableStatus(body.status);
      const createdTask = await tx.task.create({
        data: {
          asanaGid: makeLocalAsanaGid("task"),
          name: body.title,
          notes: body.description,
          localStatus: status,
          priority: body.priority ?? Priority.MEDIUM,
          assigneeGid: await assigneeGid(tx, body.assigneeId),
          startOn: dateOnly(body.startDate),
          dueOn: dateOnly(body.dueDate),
          estimatedDays: body.estimatedDays === undefined ? undefined : body.estimatedDays,
          platform: body.platform,
          discipline: body.taskDiscipline ?? body.discipline,
          estimatedTime: body.estimatedTime === undefined ? undefined : body.estimatedTime,
          maxDeadline: body.maxDeadline === undefined ? undefined : body.maxDeadline ? new Date(body.maxDeadline) : null,
          conclusionDays: body.conclusionDays === undefined ? undefined : body.conclusionDays,
          stage: body.stage,
          completed: taskStatusCompletes(status),
          completedAtAsana: completionDateForStatus(status)
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

      if (body.customFieldValues) {
        for (const field of body.customFieldValues) {
          if (field.mikaKey) {
            await upsertMikaCustomFieldValue(tx, createdTask.id, field.mikaKey, field.value);
            continue;
          }

          if (!field.settingId) {
            continue;
          }

          const setting = await tx.projectCustomFieldSetting.findUnique({
            where: { id: field.settingId },
            include: {
              customField: {
                include: { enumOptions: { where: { enabled: true } } }
              }
            }
          });

          if (!setting || setting.projectId !== section.project.id) {
            continue;
          }

          const stringValue = normalizedCustomFieldString(field.value);
          if (stringValue === null) {
            continue;
          }

          const enumMatch = setting.customField.enumOptions.find(
            (option) => option.name === stringValue || option.asanaGid === stringValue
          );
          const numericValue =
            typeof field.value === "number"
              ? field.value
              : setting.customField.type === "number" || setting.customField.type === "integer"
                ? Number(stringValue.replace(",", "."))
                : null;

          await tx.taskCustomFieldValue.create({
            data: {
              taskId: createdTask.id,
              customFieldGid: setting.customField.asanaGid,
              customFieldName: setting.customField.name,
              type: setting.customField.type,
              precision: setting.customField.precision,
              displayValue: enumMatch?.name ?? stringValue,
              numberValue: numericValue !== null && !Number.isNaN(numericValue) ? numericValue : null,
              enumOptionName: enumMatch?.name ?? null,
              enumOptionId: enumMatch?.id ?? null,
              enumOptionGid: enumMatch?.asanaGid ?? null,
              enumOptionColor: enumMatch?.color ?? null,
              customFieldId: setting.customField.id
            }
          });
        }
      }

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

    const catalog = await taskFieldCatalog();

    res.status(201).json({ task: toTaskDto(task, undefined, catalog) });
  } catch (error) {
    next(error);
  }
};

export const updateTask: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as TaskBody;
    const taskId = req.params.id;

    if (!taskId) {
      throw new AppError(400, "Task id is required");
    }

    const existing = await prisma.task.findUnique({
      where: { id: taskId },
      select: { assigneeGid: true, localStatus: true, completedAtAsana: true }
    });

    const task = await prisma.$transaction(async (tx) => {
      const status = body.status === undefined ? undefined : writableStatus(body.status);
      const effectiveStatus = status ?? writableStatus(existing?.localStatus);
      const completed = taskStatusCompletes(effectiveStatus);

      await tx.task.update({
        where: { id: taskId },
        data: {
          name: body.title,
          notes: body.description,
          localStatus: status,
          priority: body.priority,
          assigneeGid: await assigneeGid(tx, body.assigneeId),
          startOn: dateOnly(body.startDate),
          dueOn: dateOnly(body.dueDate),
          estimatedDays: body.estimatedDays === undefined ? undefined : body.estimatedDays,
          platform: body.platform,
          discipline: body.taskDiscipline ?? body.discipline,
          estimatedTime: body.estimatedTime === undefined ? undefined : body.estimatedTime,
          maxDeadline: body.maxDeadline === undefined ? undefined : body.maxDeadline ? new Date(body.maxDeadline) : null,
          conclusionDays: body.conclusionDays === undefined ? undefined : body.conclusionDays,
          stage: body.stage,
          completed,
          completedAtAsana: completionDateForStatus(effectiveStatus, existing?.completedAtAsana)
        }
      });

      if (body.customFieldValues) {
        for (const field of body.customFieldValues) {
          if (field.mikaKey && (!field.id || field.id.startsWith("mika:"))) {
            await upsertMikaCustomFieldValue(tx, taskId, field.mikaKey, field.value);
            continue;
          }

          if (!field.id) {
            continue;
          }

          const existingRow = await tx.taskCustomFieldValue.findUnique({
            where: { id: field.id },
            include: customFieldValueInclude
          });

          if (existingRow) {
            await applyCustomFieldValue(tx, existingRow, field.value);
          } else if (field.mikaKey) {
            await upsertMikaCustomFieldValue(tx, taskId, field.mikaKey, field.value);
          }
        }
      }

      return tx.task.findUniqueOrThrow({
        where: { id: taskId },
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

    const catalog = await taskFieldCatalog();

    res.json({ task: toTaskDto(task, undefined, catalog) });
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
    const status = writableStatus(body.status);
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        localStatus: status,
        completed: taskStatusCompletes(status),
        completedAtAsana: completionDateForStatus(status)
      },
      include: taskInclude
    });

    if (task.assignee) {
      await createAndEmitNotification({
        userId: task.assignee.id,
        type: "TASK_UPDATED",
        title: "Status da tarefa",
        message: `${task.name}: ${status}`,
        taskId: task.id
      });
    }

    const catalog = await taskFieldCatalog();

    res.json({ task: toTaskDto(task, undefined, catalog) });
  } catch (error) {
    next(error);
  }
};

export const updateTaskCompletion: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as CompletionBody;
    const status = body.completed ? TaskStatus.FINISHED : TaskStatus.TODO;
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        localStatus: status,
        completed: taskStatusCompletes(status),
        completedAtAsana: completionDateForStatus(status)
      },
      include: taskInclude
    });

    const catalog = await taskFieldCatalog();

    res.json({ task: toTaskDto(task, undefined, catalog) });
  } catch (error) {
    next(error);
  }
};
