import type { Prisma } from "../generated/prisma/client.js";

export function activeTaskWhere(): Prisma.TaskWhereInput {
  return { deletedAt: null };
}

export function activeTaskRelationWhere(): Prisma.TaskWhereInput {
  return activeTaskWhere();
}
