import { Router } from "express";
import { z } from "zod";
import {
  createUser,
  deleteUser,
  getUserById,
  listUsers,
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

router.use(auth);
router.get("/users", listUsers);
router.get("/users/:id", getUserById);
router.post("/users", requireRole(Role.ADMIN), validateBody(createUserSchema), createUser);
router.patch("/users/:id", validateBody(updateUserSchema), updateUser);
router.delete("/users/:id", requireRole(Role.ADMIN), deleteUser);

export default router;
