import { Router } from "express";
import { z } from "zod";
import {
  createUser,
  deleteUser,
  getUserById,
  getUserHome,
  listUsers,
  resetUserPassword,
  updateUser
} from "../controllers/users.controller.js";
import { auth } from "../middleware/auth.js";
import { Role } from "../lib/enums.js";
import { requireRole } from "../middleware/role.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(Role).optional(),
  avatarUrl: z.string().url().nullable().optional()
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.nativeEnum(Role).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  isActive: z.boolean().optional()
});

router.get("/users", auth, listUsers);
router.get("/users/:id/home", auth, requireRole(Role.COORDINATOR), getUserHome);
router.get("/users/:id", auth, getUserById);
router.post("/users", auth, requireRole(Role.COORDINATOR), validateBody(createUserSchema), createUser);
router.patch("/users/:id", auth, requireRole(Role.COORDINATOR), validateBody(updateUserSchema), updateUser);
router.patch("/users/:id/reset-password", auth, requireRole(Role.COORDINATOR), resetUserPassword);
router.delete("/users/:id", auth, requireRole(Role.COORDINATOR), deleteUser);

export default router;
