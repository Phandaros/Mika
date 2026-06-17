import type { Prisma } from "../generated/prisma/client.js";
import { TaskStatus, type TaskStatus as TaskStatusValue } from "./enums.js";

const legacyAwaitingDefinitionStatuses = [
  "aguardando definicao",
  "Aguardando Definicao",
  "Aguardando Definição",
  // Legacy mojibake value already persisted by older imports/patches.
  "Aguardando DefiniÃ§Ã£o",
  "aguardando aprovacao"
];

export function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

export function todayStart(): Date {
  return new Date(`${todayDateOnly()}T00:00:00.000Z`);
}

function awaitingDefinitionStatusWhere(): Prisma.TaskWhereInput {
  return {
    OR: [
      { mikaStatus: TaskStatus.AWAITING_DEFINITION },
      { mikaStatus: "AWAITING_DEFINITION" },
      ...legacyAwaitingDefinitionStatuses.map((mikaStatus) => ({ mikaStatus }))
    ]
  };
}

function overdueWhere(): Prisma.TaskWhereInput {
  return {
    completed: false,
    AND: [
      { OR: [{ dueOn: { lt: todayDateOnly() } }, { dueAt: { lt: todayStart() } }] },
      { NOT: awaitingDefinitionStatusWhere() }
    ]
  };
}

function notOverdueWhere(): Prisma.TaskWhereInput {
  return {
    OR: [
      { completed: true },
      {
        AND: [
          { OR: [{ dueOn: null }, { dueOn: { gte: todayDateOnly() } }] },
          { OR: [{ dueAt: null }, { dueAt: { gte: todayStart() } }] }
        ]
      }
    ]
  };
}

export function backlogStatusWhere(): Prisma.TaskWhereInput {
  return {
    OR: [
      { mikaStatus: TaskStatus.BACKLOG },
      { mikaStatus: "BACKLOG" },
      { mikaStatus: "backlog" },
      { mikaStatus: "Backlog" }
    ]
  };
}

export function excludeBacklogWhere(): Prisma.TaskWhereInput {
  return { NOT: backlogStatusWhere() };
}

export function isBacklogTask(task: { mikaStatus: string | null }): boolean {
  return normalizeBacklogMikaStatus(task.mikaStatus) === TaskStatus.BACKLOG;
}

function normalizeBacklogMikaStatus(value: string | null | undefined): TaskStatusValue | null {
  if (!value) {
    return null;
  }

  if (value === TaskStatus.BACKLOG || value.toLowerCase() === "backlog") {
    return TaskStatus.BACKLOG;
  }

  return null;
}

export function normalizedStatusWhere(status: TaskStatusValue): Prisma.TaskWhereInput {
  if (status === TaskStatus.OVERDUE) {
    return overdueWhere();
  }

  if (status === TaskStatus.BACKLOG) {
    return {
      completed: false,
      AND: [backlogStatusWhere()]
    };
  }

  if (status === TaskStatus.FINISHED) {
    return {
      completed: true
    };
  }

  if (status === TaskStatus.TODO) {
    return {
      completed: false,
      AND: [
        notOverdueWhere(),
        {
          OR: [
            { mikaStatus: null, assigneeStatus: { not: "later" } },
            { mikaStatus: TaskStatus.TODO },
            { mikaStatus: "TODO" },
            { mikaStatus: "a fazer" },
            { mikaStatus: "A fazer" }
          ]
        }
      ]
    };
  }

  if (status === TaskStatus.AWAITING_DEFINITION) {
    return {
      completed: false,
      AND: [awaitingDefinitionStatusWhere()]
    };
  }

  const legacyValues: Partial<Record<TaskStatusValue, string[]>> = {
    [TaskStatus.ON_SCHEDULE]: ["ON_SCHEDULE", "later", "no cronograma", "No Cronograma"],
    [TaskStatus.IN_PROGRESS]: ["IN_PROGRESS", "em andamento", "Em andamento"],
    [TaskStatus.AWAITING_REVIEW]: ["AWAITING_REVIEW", "IN_REVIEW", "aguardando revisao", "Aguardando Revisao", "Aguardando Revisão"],
    [TaskStatus.IN_ANALYSIS]: ["IN_ANALYSIS", "em analise", "Em Analise", "Em Análise"],
    [TaskStatus.AWAITING_DEFINITION]: [
      "AWAITING_DEFINITION",
      ...legacyAwaitingDefinitionStatuses
    ]
  };

  return {
    completed: false,
    AND: [
      notOverdueWhere(),
      {
        OR: [
          { mikaStatus: status },
          ...((legacyValues[status] ?? []).map((value) =>
            value === "later" ? { mikaStatus: null, assigneeStatus: "later" } : { mikaStatus: value }
          ) satisfies Prisma.TaskWhereInput[])
        ]
      }
    ]
  };
}

export function activeStatusesWhere(statuses: TaskStatusValue[]): Prisma.TaskWhereInput {
  if (statuses.length === 0) {
    return { id: { in: [] } };
  }

  if (statuses.length === 1) {
    return normalizedStatusWhere(statuses[0]!);
  }

  return {
    OR: statuses.map((status) => normalizedStatusWhere(status))
  };
}
