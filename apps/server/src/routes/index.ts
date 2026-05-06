import { Router } from "express";
import authRoutes from "./auth.routes.js";
import commentsRoutes from "./comments.routes.js";
import disciplinesRoutes from "./disciplines.routes.js";
import notificationsRoutes from "./notifications.routes.js";
import projectsRoutes from "./projects.routes.js";
import tasksRoutes from "./tasks.routes.js";
import uploadsRoutes from "./uploads.routes.js";
import usersRoutes from "./users.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use(usersRoutes);
router.use(projectsRoutes);
router.use(disciplinesRoutes);
router.use(tasksRoutes);
router.use(commentsRoutes);
router.use(notificationsRoutes);
router.use(uploadsRoutes);

export default router;
