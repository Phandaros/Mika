import { Router } from "express";
import { listGlobalWorkloadTasks } from "../controllers/workload.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.get("/workload/tasks", auth, listGlobalWorkloadTasks);

export default router;
