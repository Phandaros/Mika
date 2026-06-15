import { Router } from "express";
import { z } from "zod";
import { approveReview, getReviewById, listReviews, rejectReview, updateReview } from "../controllers/reviews.controller.js";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { validateBody } from "../middleware/validate.js";
import { Role } from "../lib/enums.js";
import { upload } from "../lib/upload.js";

const router = Router();

const updateReviewSchema = z.object({
  reviewerId: z.string().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional()
});

router.get("/reviews", auth, requireRole(Role.COORDINATOR), listReviews);
router.get("/reviews/:id", auth, requireRole(Role.COORDINATOR), getReviewById);
router.patch("/reviews/:id", auth, requireRole(Role.COORDINATOR), validateBody(updateReviewSchema), updateReview);
router.post("/reviews/:id/approve", auth, requireRole(Role.COORDINATOR), upload.array("files", 5), approveReview);
router.post("/reviews/:id/reject", auth, requireRole(Role.COORDINATOR), upload.array("files", 5), rejectReview);

export default router;
