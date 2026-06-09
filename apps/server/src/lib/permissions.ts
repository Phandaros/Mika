import { Role, type Role as RoleValue } from "./enums.js";

const roleWeight: Record<RoleValue, number> = {
  [Role.INTERN]: 0,
  [Role.DESIGNER]: 1,
  [Role.COORDINATOR]: 2,
  [Role.ADMIN]: 3
};

export function hasMinimumRole(role: RoleValue, minimumRole: RoleValue): boolean {
  return roleWeight[role] >= roleWeight[minimumRole];
}

export function canManageTasks(role: RoleValue): boolean {
  return hasMinimumRole(role, Role.COORDINATOR);
}

export function canCompleteTasks(role: RoleValue): boolean {
  return hasMinimumRole(role, Role.DESIGNER);
}
