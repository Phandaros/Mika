import type { Prisma } from "../generated/prisma/client.js";
import { TaskStatus, type TaskStatus as TaskStatusValue } from "./enums.js";

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
      { mikaStatus: "aguardando definicao" },
      { mikaStatus: "Aguardando Definicao" },
      { mikaStatus: "Aguardando Definição" },
      { mikaStatus: "Aguardando DefiniÃ§Ã£o" },
      { mikaStatus: "aguardando aprovacao" }
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

export function normalizedStatusWhere(status: TaskStatusValue): Prisma.TaskWhereInput {
  if (status === TaskStatus.OVERDUE) {
    return overdueWhere();
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
            { mikaStatus: "BACKLOG" },
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
    [TaskStatus.ON_SCHEDULE]: ["ON_SCHEDULE", "BACKLOG", "later", "no cronograma", "No Cronograma"],
    [TaskStatus.IN_PROGRESS]: ["IN_PROGRESS", "em andamento", "Em andamento"],
    [TaskStatus.AWAITING_REVIEW]: ["AWAITING_REVIEW", "IN_REVIEW", "aguardando revisao", "Aguardando Revisao", "Aguardando Revisão"],
    [TaskStatus.IN_ANALYSIS]: ["IN_ANALYSIS", "em analise", "Em Analise", "Em Análise"],
    [TaskStatus.AWAITING_DEFINITION]: [
      "AWAITING_DEFINITION",
      "aguardando definicao",
      "Aguardando Definicao",
      "Aguardando Definição",
      "aguardando aprovacao"
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
