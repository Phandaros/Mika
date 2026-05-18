import { Router } from "express";
import { z } from "zod";
import {
  createCompanyHoliday,
  deleteCompanyHoliday,
  listCompanyHolidays,
  updateCompanyHoliday
} from "../controllers/calendar.controller.js";
import { Role } from "../lib/enums.js";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createHolidaySchema = z.object({
  date: dateSchema,
  name: z.string().trim().min(2)
});

const updateHolidaySchema = createHolidaySchema.partial();

router.use(auth);
router.get("/calendar/holidays", listCompanyHolidays);
router.post("/calendar/holidays", requireRole(Role.ADMIN), validateBody(createHolidaySchema), createCompanyHoliday);
router.patch("/calendar/holidays/:id", requireRole(Role.ADMIN), validateBody(updateHolidaySchema), updateCompanyHoliday);
router.delete("/calendar/holidays/:id", requireRole(Role.ADMIN), deleteCompanyHoliday);

export default router;
