import type { Request, RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";
import { Role, type Role as RoleValue } from "../lib/enums.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "./errorHandler.js";

export interface JwtUser {
  id: string;
  email: string;
  name: string;
  role: RoleValue;
}

type RequestWithAuth = Request & {
  authUser?: JwtUser;
};

function isJwtUserPayload(payload: string | JwtPayload): payload is JwtPayload & JwtUser {
  if (typeof payload === "string") {
    return false;
  }

  return (
    typeof payload.id === "string" &&
    typeof payload.email === "string" &&
    typeof payload.name === "string" &&
    Object.values(Role).includes(payload.role as RoleValue)
  );
}

export const auth: RequestHandler = async (req, _res, next) => {
  try {
    const authorization = req.header("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      throw new AppError(401, "Authentication token missing");
    }

    const token = authorization.replace("Bearer ", "").trim();
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);

    if (!isJwtUserPayload(payload)) {
      throw new AppError(401, "Invalid authentication token");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, role: true, isActive: true }
    });

    if (!user?.isActive) {
      throw new AppError(401, "Inactive or missing user");
    }

    const role = Object.values(Role).includes(user.role as RoleValue)
      ? (user.role as RoleValue)
      : Role.DESIGNER;

    (req as RequestWithAuth).authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(new AppError(401, "Invalid authentication token"));
  }
};

export function getAuthUser(req: Request): JwtUser {
  const authReq = req as RequestWithAuth;

  if (!authReq.authUser) {
    throw new AppError(401, "Authentication required");
  }

  return authReq.authUser;
}
