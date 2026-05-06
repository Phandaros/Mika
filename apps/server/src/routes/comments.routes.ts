import { Router } from "express";
import { z } from "zod";
import {
  createComment,
  deleteComment,
  listComments
} from "../controllers/comments.controller.js";
import { auth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();

const commentSchema = z.object({
  content: z.string().min(1)
});

router.use(auth);
router.get("/tasks/:taskId/comments", listComments);
router.post("/tasks/:taskId/comments", validateBody(commentSchema), createComment);
router.delete("/comments/:id", deleteComment);

export default router;
