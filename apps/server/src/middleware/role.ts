import type { RequestHandler } from "express";
import { Role } from "../lib/enums.js";
import { AppError } from "./errorHandler.js";
import { getAuthUser } from "./auth.js";

const roleWeight: Record<Role, number> = {
  [Role.INTERN]: 0,
  [Role.DESIGNER]: 1,
  [Role.COORDINATOR]: 2,
  [Role.ADMIN]: 3
};

export function requireRole(minimumRole: Role): RequestHandler {
  return (req, _res, next) => {
    try {
      const user = getAuthUser(req);

      if (roleWeight[user.role] < roleWeight[minimumRole]) {
        throw new AppError(403, "Insufficient permissions");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
