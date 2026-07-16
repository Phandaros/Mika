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

const legacyStatusValues: Partial<Record<TaskStatusValue, string[]>> = {
  [TaskStatus.BACKLOG]: ["BACKLOG", "backlog", "Backlog"],
  [TaskStatus.TODO]: ["TODO", "a fazer", "A fazer"],
  [TaskStatus.ON_SCHEDULE]: ["ON_SCHEDULE", "no cronograma", "No Cronograma"],
  [TaskStatus.IN_PROGRESS]: ["IN_PROGRESS", "em andamento", "Em andamento"],
  [TaskStatus.AWAITING_REVIEW]: [
    "AWAITING_REVIEW",
    "IN_REVIEW",
    "aguardando revisao",
    "Aguardando Revisao",
    "Aguardando Revisão"
  ],
  [TaskStatus.IN_ANALYSIS]: ["IN_ANALYSIS", "em analise", "Em Analise", "Em Análise"],
  [TaskStatus.AWAITING_DEFINITION]: ["AWAITING_DEFINITION", ...legacyAwaitingDefinitionStatuses],
  [TaskStatus.FINISHED]: ["FINISHED", "DONE", "finalizado", "Finalizado", "finalizada", "Finalizada"]
};

const persistedNonFinishedStatuses = [
  TaskStatus.BACKLOG,
  TaskStatus.TODO,
  TaskStatus.ON_SCHEDULE,
  TaskStatus.IN_PROGRESS,
  TaskStatus.AWAITING_REVIEW,
  TaskStatus.IN_ANALYSIS,
  TaskStatus.AWAITING_DEFINITION
] as const;

function persistedStatusWhere(status: TaskStatusValue): Prisma.TaskWhereInput {
  return {
    OR: [
      { mikaStatus: status },
      ...(legacyStatusValues[status] ?? []).map((mikaStatus) => ({ mikaStatus }))
    ]
  };
}

function persistedNonFinishedStatusWhere(): Prisma.TaskWhereInput {
  return {
    OR: persistedNonFinishedStatuses.map((status) => persistedStatusWhere(status))
  };
}

export function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

export function todayStart(): Date {
  return new Date(`${todayDateOnly()}T00:00:00.000Z`);
}

function awaitingDefinitionStatusWhere(): Prisma.TaskWhereInput {
  return persistedStatusWhere(TaskStatus.AWAITING_DEFINITION);
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
  return persistedStatusWhere(TaskStatus.BACKLOG);
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
      completed: true,
      NOT: persistedNonFinishedStatusWhere()
    };
  }

  if (status === TaskStatus.TODO) {
    return {
      AND: [
        notOverdueWhere(),
        {
          OR: [
            {
              completed: false,
              mikaStatus: null,
              assigneeStatus: { not: "later" }
            },
            persistedStatusWhere(TaskStatus.TODO)
          ]
        }
      ]
    };
  }

  if (status === TaskStatus.AWAITING_DEFINITION) {
    return awaitingDefinitionStatusWhere();
  }

  return {
    AND: [
      notOverdueWhere(),
      {
        OR: [
          persistedStatusWhere(status),
          ...(status === TaskStatus.ON_SCHEDULE
            ? [{ completed: false, mikaStatus: null, assigneeStatus: "later" } satisfies Prisma.TaskWhereInput]
            : [])
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
