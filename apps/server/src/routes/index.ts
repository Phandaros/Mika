import { Router } from "express";
import activityRoutes from "./activity.routes.js";
import authRoutes from "./auth.routes.js";
import calendarRoutes from "./calendar.routes.js";
import commentsRoutes from "./comments.routes.js";
import sectionsRoutes from "./sections.routes.js";
import notificationsRoutes from "./notifications.routes.js";
import projectsRoutes from "./projects.routes.js";
import tasksRoutes from "./tasks.routes.js";
import updatesRoutes from "./updates.routes.js";
import uploadsRoutes from "./uploads.routes.js";
import usersRoutes from "./users.routes.js";
import workloadRoutes from "./workload.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use(activityRoutes);
router.use(calendarRoutes);
router.use(usersRoutes);
router.use(projectsRoutes);
router.use(workloadRoutes);
router.use(sectionsRoutes);
router.use(tasksRoutes);
router.use(commentsRoutes);
router.use(notificationsRoutes);
router.use("/updates", updatesRoutes);
router.use(uploadsRoutes);

export default router;
