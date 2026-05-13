import { Router } from "express";
import { listGlobalWorkloadTasks } from "../controllers/workload.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.use(auth);
router.get("/workload/tasks", listGlobalWorkloadTasks);

export default router;
