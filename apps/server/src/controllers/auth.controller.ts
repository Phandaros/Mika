import bcrypt from "bcrypt";
import type { RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";
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
      role: user.role
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" }
  );
}

function createRefreshToken(userId: string): string {
  return jwt.sign({ id: userId }, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

function publicUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

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

    if (!user?.isActive) {
      throw new AppError(401, "Invalid credentials");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError(401, "Invalid credentials");
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user.id);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/api/v1/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ user: publicUser(user), accessToken });
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = async (_req, res, next) => {
  try {
    res.clearCookie("refreshToken", { path: "/api/v1/auth" });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const me: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthUser(req);
    const user = await prisma.user.findUnique({
      where: { id: authUser.id }
    });

    if (!user?.isActive) {
      throw new AppError(401, "Inactive or missing user");
    }

    res.json({ user: publicUser(user) });
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

    const user = await prisma.user.findUnique({ where: { id: payload.id } });

    if (!user?.isActive) {
      throw new AppError(401, "Inactive or missing user");
    }

    const accessToken = createAccessToken(user);
    res.json({ user: publicUser(user), accessToken });
  } catch (error) {
    next(new AppError(401, "Invalid refresh token"));
  }
};
