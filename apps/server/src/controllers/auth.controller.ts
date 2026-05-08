import bcrypt from "bcrypt";
import type { RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";
import { makeLocalAsanaGid, normalizeRole, toPublicUser, userSelect } from "../lib/asanaDto.js";
import { prisma } from "../lib/prisma.js";
import { getAuthUser } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";

interface LoginBody {
  email: string;
  password: string;
}

function createAccessToken(user: { id: string; email: string; name: string; role: string }): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: normalizeRole(user.role)
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" }
  );
}

function createRefreshToken(userId: string): string {
  return jwt.sign({ id: userId }, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

const refreshCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: false,
  path: "/api/v1/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000
};

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) {
    return null;
  }

  const cookies = header.split(";");

  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split("=");

    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
}

function isRefreshPayload(payload: string | JwtPayload): payload is JwtPayload & { id: string } {
  return typeof payload !== "string" && typeof payload.id === "string";
}

export const login: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body as LoginBody;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user?.isActive || !user.passwordHash) {
      throw new AppError(401, "Invalid credentials");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError(401, "Invalid credentials");
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user.id);
    const publicRecord = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: userSelect });

    res.cookie("refreshToken", refreshToken, refreshCookieOptions);

    res.json({ user: toPublicUser(publicRecord), accessToken });
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = async (_req, res, next) => {
  try {
    res.clearCookie("refreshToken", { path: refreshCookieOptions.path });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const me: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthUser(req);
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: userSelect
    });

    if (!user?.isActive) {
      throw new AppError(401, "Inactive or missing user");
    }

    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
};

export const refresh: RequestHandler = async (req, res, next) => {
  try {
    const token = readCookie(req.header("Cookie"), "refreshToken");

    if (!token) {
      throw new AppError(401, "Refresh token missing");
    }

    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET);

    if (!isRefreshPayload(payload)) {
      throw new AppError(401, "Invalid refresh token");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: userSelect
    });

    if (!user?.isActive) {
      throw new AppError(401, "Inactive or missing user");
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user.id);
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);
    res.json({ user: toPublicUser(user), accessToken });
  } catch {
    next(new AppError(401, "Invalid refresh token"));
  }
};

export const createInitialAdmin = async (): Promise<void> => {
  const email = "admin@mkengenharia.eng.br";
  const existingAdmin = await prisma.user.findUnique({ where: { email } });

  if (existingAdmin) {
    return;
  }

  await prisma.user.create({
    data: {
      asanaGid: makeLocalAsanaGid("user"),
      email,
      name: "Admin MK",
      passwordHash: await bcrypt.hash("admin123", 10),
      role: "ADMIN"
    }
  });
};
