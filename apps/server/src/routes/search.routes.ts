import { Router } from "express";
import { globalSearch } from "../controllers/search.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.get("/search", auth, globalSearch);

export default router;
