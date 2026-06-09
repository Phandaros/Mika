import { Role, type User } from "shared";

const roleWeight: Record<Role, number> = {
  [Role.INTERN]: 0,
  [Role.DESIGNER]: 1,
  [Role.COORDINATOR]: 2,
  [Role.ADMIN]: 3
};

export function hasMinimumRole(user: Pick<User, "role"> | null | undefined, minimumRole: Role): boolean {
  return Boolean(user && roleWeight[user.role] >= roleWeight[minimumRole]);
}

export function canManageTasks(user: Pick<User, "role"> | null | undefined): boolean {
  return hasMinimumRole(user, Role.COORDINATOR);
}

export function canCompleteTasks(user: Pick<User, "role"> | null | undefined): boolean {
  return hasMinimumRole(user, Role.DESIGNER);
}
