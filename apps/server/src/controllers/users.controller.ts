import bcrypt from "bcrypt";
import type { Prisma } from "../generated/prisma/client.js";
import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { Role, type Role as RoleValue } from "../lib/enums.js";
import { toPublicUser, userSelect } from "../lib/asanaDto.js";
import { AppError } from "../middleware/errorHandler.js";

interface CreateUserBody {
  name: string;
  email: string;
  password: string;
  role?: RoleValue;
  avatarUrl?: string | null;
}

interface UpdateUserBody {
  name?: string;
  email?: string;
  password?: string;
  role?: RoleValue;
  avatarUrl?: string | null;
  isActive?: boolean;
}

export const listUsers: RequestHandler = async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: userSelect
    });

    res.json({ users: users.map(toPublicUser).filter(Boolean) });
  } catch (error) {
    next(error);
  }
};

export const getUserById: RequestHandler = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: userSelect
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
};

export const createUser: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as CreateUserBody;
    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash,
        role: body.role ?? Role.DESIGNER,
        photo128x128: body.avatarUrl
      },
      select: userSelect
    });

    res.status(201).json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
};

export const updateUser: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as UpdateUserBody;
    const data: Prisma.UserUpdateInput = {
      name: body.name,
      email: body.email,
      role: body.role,
      photo128x128: body.avatarUrl,
      isActive: body.isActive
    };

    if (body.password) {
      data.passwordHash = await bcrypt.hash(body.password, 10);
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: userSelect
    });

    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
};

export const deleteUser: RequestHandler = async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
      select: userSelect
    });

    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
};

export const resetUserPassword: RequestHandler = async (req, res, next) => {
  try {
    const temporaryPassword = `mk${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash: await bcrypt.hash(temporaryPassword, 10) },
      select: userSelect
    });

    res.json({ user: toPublicUser(user), temporaryPassword });
  } catch (error) {
    next(error);
  }
};
