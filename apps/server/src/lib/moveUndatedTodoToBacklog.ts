import type { PrismaClient } from "../generated/prisma/client.js";
import { TaskStatus } from "./enums.js";
import { normalizeTaskStatus } from "./taskStatus.js";
import { isBacklogTask } from "./taskStatusWhere.js";

export interface UndatedTodoTaskCandidate {
  id: string;
  name: string;
  mikaStatus: string | null;
}

export interface MoveUndatedTodoToBacklogSummary {
  scanned: number;
  eligible: number;
  updated: number;
  sample: UndatedTodoTaskCandidate[];
}

export function isUndatedTodoTaskCandidate(task: {
  completed: boolean;
  mikaStatus: string | null;
  assigneeStatus: string | null;
  startOn: string | null;
  dueOn: string | null;
  dueAt: Date | null;
}): boolean {
  if (task.completed) {
    return false;
  }

  if (isBacklogTask(task)) {
    return false;
  }

  if (task.startOn || task.dueOn || task.dueAt) {
    return false;
  }

  return normalizeTaskStatus(task) === TaskStatus.TODO;
}

export async function runMoveUndatedTodoToBacklog(
  prisma: PrismaClient,
  options: { apply: boolean; sampleSize?: number }
): Promise<MoveUndatedTodoToBacklogSummary> {
  const sampleSize = options.sampleSize ?? 20;
  const tasks = await prisma.task.findMany({
    where: {
      completed: false,
      startOn: null,
      dueOn: null,
      dueAt: null
    },
    select: {
      id: true,
      name: true,
      mikaStatus: true,
      assigneeStatus: true,
      completed: true,
      startOn: true,
      dueOn: true,
      dueAt: true
    }
  });

  const eligible = tasks.filter(isUndatedTodoTaskCandidate);
  let updated = 0;

  if (options.apply && eligible.length > 0) {
    const result = await prisma.task.updateMany({
      where: { id: { in: eligible.map((task) => task.id) } },
      data: {
        mikaStatus: TaskStatus.BACKLOG,
        updatedAt: new Date()
      }
    });
    updated = result.count;
  }

  return {
    scanned: tasks.length,
    eligible: eligible.length,
    updated,
    sample: eligible.slice(0, sampleSize).map((task) => ({
      id: task.id,
      name: task.name,
      mikaStatus: task.mikaStatus
    }))
  };
}

export function printMoveUndatedTodoToBacklogSummary(summary: MoveUndatedTodoToBacklogSummary, apply: boolean): void {
  const mode = apply ? "APPLY" : "DRY-RUN";

  console.log(`[move-undated-todo-to-backlog] modo=${mode}`);
  console.log(`Tarefas abertas sem data analisadas: ${summary.scanned}`);
  console.log(`Elegíveis (status "A fazer" sem data): ${summary.eligible}`);

  if (apply) {
    console.log(`Atualizadas para BACKLOG: ${summary.updated}`);
  } else {
    console.log(`Seriam movidas para BACKLOG: ${summary.eligible}`);
  }

  if (summary.sample.length > 0) {
    console.log("Amostra:");
    for (const task of summary.sample) {
      console.log(`  - ${task.id} | ${task.mikaStatus ?? "(null)"} | ${task.name}`);
    }
  }
}
