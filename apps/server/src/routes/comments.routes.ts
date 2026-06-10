import { Router } from "express";
import { z } from "zod";
import {
  createComment,
  deleteComment,
  listComments,
  updateComment
} from "../controllers/comments.controller.js";
import { auth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();

const commentSchema = z.object({
  content: z.string().min(1)
});

router.get("/tasks/:taskId/comments", auth, listComments);
router.post("/tasks/:taskId/comments", auth, validateBody(commentSchema), createComment);
router.patch("/comments/:id", auth, validateBody(commentSchema), updateComment);
router.delete("/comments/:id", auth, deleteComment);

export default router;
