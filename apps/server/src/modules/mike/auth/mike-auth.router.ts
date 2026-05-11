import { Router } from "express";
import { auth } from "../../../middleware/auth.js";
import { validateBody } from "../../../middleware/validate.js";
import { login, me } from "./mike-auth.controller.js";
import { mikeAuthLoginSchema } from "./mike-auth.schema.js";

const router = Router();

router.post("/login", validateBody(mikeAuthLoginSchema), login);
router.get("/me", auth, me);

export default router;
