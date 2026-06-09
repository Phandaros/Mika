import type { RequestHandler } from "express";
import { Role } from "../lib/enums.js";
import { hasMinimumRole } from "../lib/permissions.js";
import { AppError } from "./errorHandler.js";
import { getAuthUser } from "./auth.js";

export function requireRole(minimumRole: Role): RequestHandler {
  return (req, _res, next) => {
    try {
      const user = getAuthUser(req);

      if (!hasMinimumRole(user.role, minimumRole)) {
        throw new AppError(403, "Insufficient permissions");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
