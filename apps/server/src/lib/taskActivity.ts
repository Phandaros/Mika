import type { Prisma } from "../generated/prisma/client.js";
import { toPublicUser, userSelect } from "./asanaDto.js";

export const taskActivityTypes = {
  CREATED: "CREATED",
  UPDATED: "UPDATED",
  COMPLETED: "COMPLETED",
  REOPENED: "REOPENED",
  COMMENTED: "COMMENTED"
} as const;

export type TaskActivityType = (typeof taskActivityTypes)[keyof typeof taskActivityTypes];

export interface TaskActivityInput {
  taskId: string;
  actorId: string | null;
  type: TaskActivityType;
  field?: string | null;
  fromValue?: string | number | boolean | null;
  toValue?: string | number | boolean | null;
  metadata?: Record<string, unknown> | null;
}

const activityInclude = {
  actor: { select: userSelect }
} satisfies Prisma.TaskActivityInclude;

export type TaskActivityRecord = Prisma.TaskActivityGetPayload<{ include: typeof activityInclude }>;

export function taskActivityInclude() {
  return activityInclude;
}

export async function createTaskActivity(tx: Prisma.TransactionClient, input: TaskActivityInput): Promise<void> {
  await tx.taskActivity.create({
    data: {
      taskId: input.taskId,
      actorId: input.actorId,
      type: input.type,
      field: input.field ?? null,
      fromValue: stringifyActivityValue(input.fromValue),
      toValue: stringifyActivityValue(input.toValue),
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null
    }
  });
}

export async function createTaskUpdateActivity(
  tx: Prisma.TransactionClient,
  input: Omit<TaskActivityInput, "type"> & { type?: TaskActivityType }
): Promise<void> {
  const fromValue = stringifyActivityValue(input.fromValue);
  const toValue = stringifyActivityValue(input.toValue);

  if (fromValue === toValue) {
    return;
  }

  await createTaskActivity(tx, {
    ...input,
    type: input.type ?? taskActivityTypes.UPDATED
  });
}

export function toTaskActivityDto(activity: TaskActivityRecord) {
  return {
    id: activity.id,
    taskId: activity.taskId,
    actorId: activity.actorId,
    type: activity.type,
    field: activity.field,
    fromValue: activity.fromValue,
    toValue: activity.toValue,
    metadata: parseMetadata(activity.metadataJson),
    createdAt: activity.createdAt,
    actor: toPublicUser(activity.actor)
  };
}

function stringifyActivityValue(value: string | number | boolean | null | undefined): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

function parseMetadata(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
