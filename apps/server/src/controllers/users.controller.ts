import bcrypt from "bcrypt";
import type { Prisma } from "@prisma/client";
import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { Role, type Role as RoleValue } from "../lib/enums.js";
import { AppError } from "../middleware/errorHandler.js";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatarUrl: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UserSelect;

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

    res.json({ users });
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

    res.json({ user });
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
        avatarUrl: body.avatarUrl
      },
      select: userSelect
    });

    res.status(201).json({ user });
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
      avatarUrl: body.avatarUrl,
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

    res.json({ user });
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

    res.json({ user });
  } catch (error) {
    next(error);
  }
};
