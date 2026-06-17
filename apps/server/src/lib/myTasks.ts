import type { Prisma } from "../generated/prisma/client.js";
import { Role, type Role as RoleValue, type TaskStatus as TaskStatusValue } from "./enums.js";
import { taskInclude } from "./asanaDto.js";
import { hasMinimumRole } from "./permissions.js";
import { prisma } from "./prisma.js";
import { activeStatusesWhere, excludeBacklogWhere } from "./taskStatusWhere.js";

export type MyTasksCompletionFilter = "open" | "completed" | "all";

export type MyTasksFilters = {
  asanaGid: string;
  completion?: MyTasksCompletionFilter;
  status?: TaskStatusValue[];
  search?: string;
};

export function resolveMyTasksTargetUserId(
  authUser: { id: string; role: RoleValue },
  requestedUserId?: string
): string {
  if (requestedUserId && hasMinimumRole(authUser.role, Role.COORDINATOR)) {
    return requestedUserId;
  }

  return authUser.id;
}

function completionWhere(completion: MyTasksCompletionFilter | undefined): Prisma.TaskWhereInput {
  if (completion === "completed") {
    return { completed: true };
  }

  if (completion === "all") {
    return {};
  }

  return { completed: false };
}

function searchWhere(search: string | undefined): Prisma.TaskWhereInput {
  const normalized = search?.trim();
  if (!normalized) {
    return {};
  }

  return {
    OR: [
      { name: { contains: normalized } },
      { notes: { contains: normalized } }
    ]
  };
}

export function buildMyTasksWhere(filters: MyTasksFilters): Prisma.TaskWhereInput {
  const statusFilter =
    filters.status && filters.status.length > 0
      ? activeStatusesWhere(filters.status)
      : {};

  return {
    AND: [
      { parentId: null },
      { assigneeGid: filters.asanaGid },
      excludeBacklogWhere(),
      completionWhere(filters.completion),
      statusFilter,
      searchWhere(filters.search)
    ]
  };
}

export async function loadMyTasks(filters: MyTasksFilters) {
  return prisma.task.findMany({
    where: buildMyTasksWhere(filters),
    include: taskInclude,
    orderBy: [{ dueOn: "asc" }, { updatedAt: "desc" }]
  });
}
