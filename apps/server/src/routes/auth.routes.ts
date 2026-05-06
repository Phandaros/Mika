import { Router } from "express";
import { z } from "zod";
import { login, logout, me, refresh } from "../controllers/auth.controller.js";
import { auth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post("/login", validateBody(loginSchema), login);
router.post("/logout", logout);
router.get("/me", auth, me);
router.post("/refresh", refresh);

export default router;
