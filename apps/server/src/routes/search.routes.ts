import { Router } from "express";
import { advancedSearch, globalSearch } from "../controllers/search.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.get("/search/advanced", auth, advancedSearch);
router.get("/search", auth, globalSearch);

export default router;
