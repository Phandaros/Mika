import type { Prisma } from "../generated/prisma/client.js";
import type { RequestHandler } from "express";
import { NotificationType } from "shared";
import { prisma } from "../lib/prisma.js";
import { Priority, Role, TaskStatus, type Priority as PriorityValue, type TaskStatus as TaskStatusValue } from "../lib/enums.js";
import { makeLocalAsanaGid, taskCustomFieldCatalogInclude, taskInclude, toTaskDto } from "../lib/asanaDto.js";
import { isCanonicalSectionName } from "../lib/canonicalSections.js";
import { writableTaskStatus } from "../lib/taskStatus.js";
import { AppError } from "../middleware/errorHandler.js";
import { createAndEmitNotification } from "../lib/notify.js";
import { getAuthUser } from "../middleware/auth.js";
import { applyTaskRules, ensurePendingTaskReview } from "../lib/taskRules.js";
import { createTaskActivity, createTaskUpdateActivity, taskActivityInclude, taskActivityTypes, toTaskActivityDto } from "../lib/taskActivity.js";

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
  projectId?: string | null;
  sectionId?: string | null;
  projectIds?: string[];
  projectMemberships?: Array<{
    projectId: string;
    sectionId?: string | null;
  }>;
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

interface SendToReviewBody {
  reviewerId: string;
}

type PendingTaskReviewDtoInput = {
  id: string;
  sourceTaskId: string;
  rootTaskId: string;
  reviewerId: string;
  requestedById: string | null;
  status: string;
  message: string | null;
  startOn: string | null;
  dueOn: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ExistingTaskForActivity = Prisma.TaskGetPayload<{
  include: {
    assignee: { select: { id: true; name: true } };
    memberships: true;
  };
}>;

function dateOnly(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!value) {
    return null;
  }

  return value.slice(0, 10);
}

function writableStatus(value: TaskStatusValue | string | null | undefined): TaskStatusValue {
  return writableTaskStatus(value);
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

function taskMembershipSummary(memberships: Array<{ projectName: string | null; sectionName: string | null }>): string | null {
  const labels = memberships
    .map((membership) =>
      [membership.projectName, membership.sectionName].filter((value): value is string => Boolean(value)).join(" / ")
    )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  return labels.length > 0 ? labels.join(", ") : null;
}

function toPendingTaskReviewDto(review: PendingTaskReviewDtoInput, title: string) {
  return {
    id: review.id,
    title,
    discipline: "Revisão" as const,
    sourceTaskId: review.sourceTaskId,
    rootTaskId: review.rootTaskId,
    reviewerId: review.reviewerId,
    requestedById: review.requestedById,
    status: review.status,
    message: review.message,
    startDate: review.startOn,
    dueDate: review.dueOn,
    decidedAt: review.decidedAt?.toISOString() ?? null,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString()
  };
}

async function validateReviewAssignee(tx: Prisma.TransactionClient, reviewerId: string): Promise<void> {
  const reviewer = await tx.user.findUnique({
    where: { id: reviewerId },
    select: { id: true, role: true, isActive: true }
  });

  if (!reviewer?.isActive || (reviewer.role !== Role.ADMIN && reviewer.role !== Role.COORDINATOR)) {
    throw new AppError(400, "Responsável de revisão inválido");
  }
}

async function recordTaskFieldActivities(
  tx: Prisma.TransactionClient,
  taskId: string,
  actorId: string,
  existing: ExistingTaskForActivity,
  updated: Prisma.TaskGetPayload<{ include: typeof taskInclude }>,
  body: TaskBody
): Promise<void> {
  const fixedComparisons: Array<{
    field: string;
    touched: boolean;
    fromValue: string | number | boolean | null | undefined;
    toValue: string | number | boolean | null | undefined;
  }> = [
    { field: "title", touched: body.title !== undefined, fromValue: existing.name, toValue: updated.name },
    { field: "description", touched: body.description !== undefined, fromValue: existing.notes, toValue: updated.notes },
    { field: "status", touched: body.status !== undefined, fromValue: existing.mikaStatus, toValue: updated.mikaStatus },
    { field: "priority", touched: body.priority !== undefined, fromValue: existing.priority, toValue: updated.priority },
    { field: "assignee", touched: body.assigneeId !== undefined, fromValue: existing.assignee?.name, toValue: updated.assignee?.name },
    { field: "startDate", touched: body.startDate !== undefined, fromValue: dateOnly(existing.startOn), toValue: dateOnly(updated.startOn) },
    { field: "dueDate", touched: body.dueDate !== undefined, fromValue: dateOnly(existing.dueOn), toValue: dateOnly(updated.dueOn) },
    { field: "estimatedDays", touched: body.estimatedDays !== undefined, fromValue: existing.estimatedDays, toValue: updated.estimatedDays },
    { field: "platform", touched: body.platform !== undefined, fromValue: existing.platform, toValue: updated.platform },
    {
      field: "discipline",
      touched: body.taskDiscipline !== undefined || body.discipline !== undefined,
      fromValue: existing.discipline,
      toValue: updated.discipline
    },
    { field: "estimatedTime", touched: body.estimatedTime !== undefined, fromValue: existing.estimatedTime, toValue: updated.estimatedTime },
    {
      field: "maxDeadline",
      touched: body.maxDeadline !== undefined,
      fromValue: existing.maxDeadline?.toISOString().slice(0, 10),
      toValue: updated.maxDeadline?.toISOString().slice(0, 10)
    },
    { field: "conclusionDays", touched: body.conclusionDays !== undefined, fromValue: existing.conclusionDays, toValue: updated.conclusionDays },
    { field: "stage", touched: body.stage !== undefined, fromValue: existing.stage, toValue: updated.stage }
  ];

  for (const comparison of fixedComparisons) {
    if (!comparison.touched) {
      continue;
    }

    await createTaskUpdateActivity(tx, {
      taskId,
      actorId,
      field: comparison.field,
      fromValue: comparison.fromValue,
      toValue: comparison.toValue
    });
  }

  if (body.projectMemberships !== undefined || body.projectIds !== undefined) {
    await createTaskUpdateActivity(tx, {
      taskId,
      actorId,
      field: "projectMemberships",
      fromValue: taskMembershipSummary(existing.memberships),
      toValue: taskMembershipSummary(updated.memberships)
    });
  }
}

async function syncTaskProjectMemberships(
  tx: Prisma.TransactionClient,
  taskId: string,
  projectIds: string[] | undefined
): Promise<void> {
  if (projectIds === undefined) {
    return;
  }

  throw new AppError(400, "Informe a seção de cada projeto da tarefa");
}

async function syncTaskProjectSectionMemberships(
  tx: Prisma.TransactionClient,
  taskId: string,
  projectMemberships: Array<{ projectId: string; sectionId?: string | null }> | undefined
): Promise<void> {
  if (projectMemberships === undefined) {
    return;
  }

  if (projectMemberships.length === 0) {
    throw new AppError(400, "A tarefa precisa estar vinculada a pelo menos um projeto e uma seção");
  }

  if (projectMemberships.some((item) => !item.sectionId)) {
    throw new AppError(400, "Toda tarefa precisa ter uma seção em cada projeto");
  }

  const uniqueProjectIds = new Set(projectMemberships.map((item) => item.projectId));
  if (uniqueProjectIds.size !== projectMemberships.length) {
    throw new AppError(400, "Informe apenas uma seção por projeto");
  }

  const uniqueMemberships = projectMemberships as Array<{ projectId: string; sectionId: string }>;
  const projectIds = [...new Set(uniqueMemberships.map((item) => item.projectId))];
  const sectionIds = [...new Set(uniqueMemberships.map((item) => item.sectionId))];

  const [projects, sections] = await Promise.all([
    tx.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, asanaGid: true, name: true }
    }),
    sectionIds.length
      ? tx.section.findMany({
          where: { id: { in: sectionIds } },
          include: { project: { select: { id: true, asanaGid: true, name: true } } }
        })
      : Promise.resolve([])
  ]);

  if (projects.length !== projectIds.length) {
    throw new AppError(400, "Um ou mais projetos selecionados nao existem");
  }

  if (sections.length !== sectionIds.length) {
    throw new AppError(400, "Uma ou mais secoes selecionadas nao existem");
  }

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  await tx.taskMembership.deleteMany({ where: { taskId } });

  for (const membership of uniqueMemberships) {
    const project = projectById.get(membership.projectId);
    if (!project) {
      continue;
    }

    const section = sectionById.get(membership.sectionId);
    if (!section) {
      throw new AppError(400, "Uma ou mais secoes selecionadas nao existem");
    }

    if (section.project.id !== project.id) {
      throw new AppError(400, "A seção selecionada não pertence ao projeto");
    }

    if (!isCanonicalSectionName(section.name)) {
      throw new AppError(400, "A seção selecionada deve ser Civil ou Elétrico");
    }

    await tx.taskMembership.create({
      data: {
        taskId,
        projectGid: section.project.asanaGid,
        projectName: section.project.name,
        sectionGid: section.asanaGid,
        sectionName: section.name
      }
    });
  }
}

async function createOptionalTaskMembership(
  tx: Prisma.TransactionClient,
  taskId: string,
  body: TaskBody,
  routeSectionId: string
): Promise<void> {
  const requestedSectionId = body.sectionId || routeSectionId;

  if (!requestedSectionId) {
    throw new AppError(400, "Toda tarefa precisa ter uma seção");
  }

  const section = await tx.section.findUnique({
    where: { id: requestedSectionId },
    include: { project: true }
  });

  if (!section) {
    throw new AppError(404, "Section not found");
  }

  if (!isCanonicalSectionName(section.name)) {
    throw new AppError(400, "A seção selecionada deve ser Civil ou Elétrico");
  }

  if (body.projectId && body.projectId !== section.project.id) {
    throw new AppError(400, "A seção selecionada não pertence ao projeto");
  }

  await tx.taskMembership.create({
    data: {
      taskId,
      projectGid: section.projectGid,
      projectName: section.project.name,
      sectionGid: section.asanaGid,
      sectionName: section.name
    }
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
    const authUser = getAuthUser(req);
    const body = req.body as Required<Pick<TaskBody, "title">> & TaskBody;
    const routeSectionId = sectionIdFromReq(req);

    const task = await prisma.$transaction(async (tx) => {
      const status = writableStatus(body.status);
      const createdTask = await tx.task.create({
        data: {
          asanaGid: makeLocalAsanaGid("task"),
          name: body.title,
          notes: body.description,
          mikaStatus: status,
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
          completed: false,
          completedAtAsana: null,
          createdByUserId: authUser.id
        }
      });

      await createOptionalTaskMembership(tx, createdTask.id, body, routeSectionId);

      if (body.customFieldValues) {
        for (const field of body.customFieldValues) {
          if (field.mikaKey) {
            await upsertMikaCustomFieldValue(tx, createdTask.id, field.mikaKey, field.value);
            continue;
          }

          if (!field.settingId) {
            continue;
          }

          const customField = await tx.asanaCustomField.findFirst({
            where: {
              OR: [{ id: field.settingId }, { mikaKey: field.settingId }, { asanaGid: field.settingId }]
            },
            include: {
              enumOptions: { where: { enabled: true } }
            }
          });

          if (!customField) {
            continue;
          }

          const stringValue = normalizedCustomFieldString(field.value);
          if (stringValue === null) {
            continue;
          }

          const enumMatch = customField.enumOptions.find(
            (option: { name: string; asanaGid: string }) =>
              option.name === stringValue || option.asanaGid === stringValue
          );
          const numericValue =
            typeof field.value === "number"
              ? field.value
              : customField.type === "number" || customField.type === "integer"
                ? Number(stringValue.replace(",", "."))
                : null;

          await tx.taskCustomFieldValue.create({
            data: {
              taskId: createdTask.id,
              customFieldGid: customField.asanaGid,
              customFieldName: customField.name,
              type: customField.type,
              precision: customField.precision,
              displayValue: enumMatch?.name ?? stringValue,
              numberValue: numericValue !== null && !Number.isNaN(numericValue) ? numericValue : null,
              enumOptionName: enumMatch?.name ?? null,
              enumOptionId: enumMatch?.id ?? null,
              enumOptionGid: enumMatch?.asanaGid ?? null,
              enumOptionColor: enumMatch?.color ?? null,
              customFieldId: customField.id
            }
          });
        }
      }

      await createTaskActivity(tx, {
        taskId: createdTask.id,
        actorId: authUser.id,
        type: taskActivityTypes.CREATED,
        field: "task",
        toValue: createdTask.name
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
        title: "Nova tarefa atribuída",
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
    const authUser = getAuthUser(req);
    const body = req.body as TaskBody;
    const taskId = req.params.id;

    if (!taskId) {
      throw new AppError(400, "Task id is required");
    }

    const existing = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { id: true, name: true } },
        memberships: true
      }
    });

    if (!existing) {
      throw new AppError(404, "Task not found");
    }

    const task = await prisma.$transaction(async (tx) => {
      const status = body.status === undefined ? undefined : writableStatus(body.status);

      await tx.task.update({
        where: { id: taskId },
        data: {
          name: body.title,
          notes: body.description,
          mikaStatus: status,
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
          stage: body.stage
        }
      });

      if (body.projectMemberships !== undefined) {
        await syncTaskProjectSectionMemberships(tx, taskId, body.projectMemberships);
      } else {
        await syncTaskProjectMemberships(tx, taskId, body.projectIds);
      }

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

      const shouldRecalculateStatus =
        body.startDate !== undefined || body.dueDate !== undefined || body.assigneeId !== undefined;

      if (status !== undefined || shouldRecalculateStatus) {
        await applyTaskRules(tx, taskId, { actor: authUser, status, recalculateOpenStatus: shouldRecalculateStatus });
      }

      const updatedTask = await tx.task.findUniqueOrThrow({
        where: { id: taskId },
        include: taskInclude
      });

      await recordTaskFieldActivities(tx, taskId, authUser.id, existing, updatedTask, body);

      return updatedTask;
    });

    const newGid = task.assignee?.asanaGid ?? null;
    if (body.assigneeId !== undefined && existing?.assigneeGid !== newGid && task.assignee) {
      await createAndEmitNotification({
        userId: task.assignee.id,
        type: "TASK_ASSIGNED",
        title: "Tarefa atribuída a você",
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
    const authUser = getAuthUser(req);
    const body = req.body as StatusBody;
    const taskId = req.params.id;
    if (!taskId) {
      throw new AppError(400, "Task id is required");
    }
    const status = writableStatus(body.status);
    const existing = await prisma.task.findUnique({
      where: { id: taskId },
      select: { mikaStatus: true }
    });

    if (!existing) {
      throw new AppError(404, "Task not found");
    }

    const task = await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: {
          mikaStatus: status
        }
      });

      await applyTaskRules(tx, taskId, { actor: authUser, status });

      const updatedTask = await tx.task.findUniqueOrThrow({
        where: { id: taskId },
        include: taskInclude
      });

      await createTaskUpdateActivity(tx, {
        taskId,
        actorId: authUser.id,
        field: "status",
        fromValue: existing.mikaStatus,
        toValue: updatedTask.mikaStatus
      });

      return updatedTask;
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
    const authUser = getAuthUser(req);
    const body = req.body as CompletionBody;
    const taskId = req.params.id;
    if (!taskId) {
      throw new AppError(400, "Task id is required");
    }
    const existing = await prisma.task.findUnique({
      where: { id: taskId },
      select: { completed: true, completedAtAsana: true, mikaStatus: true }
    });

    if (!existing) {
      throw new AppError(404, "Task not found");
    }

    const task = await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: {
          completed: body.completed,
          completedAtAsana: body.completed ? new Date() : null
        }
      });

      await applyTaskRules(tx, taskId, { actor: authUser, completed: body.completed });

      const updatedTask = await tx.task.findUniqueOrThrow({
        where: { id: taskId },
        include: taskInclude
      });

      await createTaskUpdateActivity(tx, {
        taskId,
        actorId: authUser.id,
        type: body.completed ? taskActivityTypes.COMPLETED : taskActivityTypes.REOPENED,
        field: "completed",
        fromValue: existing.completed,
        toValue: updatedTask.completed
      });

      if (existing.mikaStatus !== updatedTask.mikaStatus) {
        await createTaskUpdateActivity(tx, {
          taskId,
          actorId: authUser.id,
          field: "status",
          fromValue: existing.mikaStatus,
          toValue: updatedTask.mikaStatus
        });
      }

      return updatedTask;
    });

    const catalog = await taskFieldCatalog();

    res.json({ task: toTaskDto(task, undefined, catalog) });
  } catch (error) {
    next(error);
  }
};

export const sendTaskToReview: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthUser(req);
    const body = req.body as SendToReviewBody;
    const taskId = req.params.id;

    if (!taskId) {
      throw new AppError(400, "Task id is required");
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.task.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          name: true,
          mikaStatus: true,
          completed: true
        }
      });

      if (!existing) {
        throw new AppError(404, "Task not found");
      }

      if (existing.mikaStatus === TaskStatus.FINISHED) {
        throw new AppError(400, "Tarefas finalizadas não podem ser enviadas para revisão");
      }

      await validateReviewAssignee(tx, body.reviewerId);

      const pendingReview = await tx.taskReview.findFirst({
        where: { sourceTaskId: taskId, status: "PENDING" },
        select: { id: true, reviewerId: true }
      });

      if (!pendingReview) {
        await tx.task.update({
          where: { id: taskId },
          data: {
            mikaStatus: TaskStatus.AWAITING_REVIEW,
            completed: true,
            completedAtAsana: new Date()
          }
        });
      }

      const review = await ensurePendingTaskReview(tx, taskId, authUser.id, { reviewerId: body.reviewerId });

      if (!review) {
        throw new AppError(400, "Nenhum coordenador ativo disponível para revisar esta tarefa");
      }

      const updatedTask = await tx.task.findUniqueOrThrow({
        where: { id: taskId },
        include: taskInclude
      });

      if (!pendingReview) {
        await createTaskUpdateActivity(tx, {
          taskId,
          actorId: authUser.id,
          type: taskActivityTypes.COMPLETED,
          field: "status",
          fromValue: existing.mikaStatus,
          toValue: updatedTask.mikaStatus
        });
      } else if (pendingReview.reviewerId !== review.reviewerId) {
        await createTaskUpdateActivity(tx, {
          taskId,
          actorId: authUser.id,
          field: "reviewer",
          fromValue: pendingReview.reviewerId,
          toValue: review.reviewerId
        });
      }

      if (!pendingReview && !existing.completed) {
        await createTaskUpdateActivity(tx, {
          taskId,
          actorId: authUser.id,
          field: "completed",
          fromValue: existing.completed,
          toValue: updatedTask.completed
        });
      }

      return { task: updatedTask, review, shouldNotify: !pendingReview || pendingReview.reviewerId !== review.reviewerId };
    });

    if (result.shouldNotify) {
      await createAndEmitNotification({
        userId: result.review.reviewerId,
        type: NotificationType.TASK_REVIEW_REQUESTED,
        title: "Nova revisão",
        message: result.task.name,
        taskId: result.task.id
      });
    }

    const catalog = await taskFieldCatalog();
    const task = toTaskDto(result.task, undefined, catalog);

    res.json({
      task,
      review: toPendingTaskReviewDto(result.review, task.title)
    });
  } catch (error) {
    next(error);
  }
};

export const listTaskHistory: RequestHandler = async (req, res, next) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id }, select: { id: true } });

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    const activities = await prisma.taskActivity.findMany({
      where: { taskId: task.id },
      orderBy: { createdAt: "desc" },
      include: taskActivityInclude()
    });

    res.json({ activities: activities.map(toTaskActivityDto) });
  } catch (error) {
    next(error);
  }
};
