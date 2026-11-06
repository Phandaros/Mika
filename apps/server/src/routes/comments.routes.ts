import { Router } from "express";
import { z } from "zod";
import {
  createComment,
  deleteComment,
  listCommentRevisions,
  listComments,
  updateComment
} from "../controllers/comments.controller.js";
import { Role } from "../lib/enums.js";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();

const commentSchema = z.object({
  content: z.string().min(1)
});

const updateCommentSchema = commentSchema.extend({
  expectedUpdatedAt: z.string().datetime({ offset: true }).optional()
});

router.get("/tasks/:taskId/comments", auth, listComments);
router.post("/tasks/:taskId/comments", auth, validateBody(commentSchema), createComment);
router.get("/tasks/:taskId/comment-revisions", auth, requireRole(Role.COORDINATOR), listCommentRevisions);
router.patch("/comments/:id", auth, validateBody(updateCommentSchema), updateComment);
router.delete("/comments/:id", auth, deleteComment);

export default router;
