import { Router } from "express";
import {
  deleteAttachment,
  downloadAttachment,
  serveAttachment,
  uploadAttachment,
  uploadAttachments,
  uploadInlineImage
} from "../controllers/uploads.controller.js";
import { upload } from "../lib/upload.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.post("/attachments/image-upload", auth, upload.single("image"), uploadInlineImage);
router.post("/comments/:commentId/attachments", auth, upload.array("files", 5), uploadAttachments);
router.get("/attachments/:id/file", auth, serveAttachment);
router.get("/attachments/:id/download", auth, downloadAttachment);
router.delete("/attachments/:id", auth, deleteAttachment);

// Legado — tarefas (501)
router.post("/tasks/:taskId/attachments", auth, upload.single("file"), uploadAttachment);

export default router;
