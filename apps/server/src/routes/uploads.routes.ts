import fs from "node:fs";
import { Router } from "express";
import multer from "multer";
import {
  deleteAttachment,
  downloadAttachment,
  uploadAttachment
} from "../controllers/uploads.controller.js";
import { env } from "../config/env.js";
import { auth } from "../middleware/auth.js";

const router = Router();

fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

const upload = multer({
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1
  }
});

router.post("/tasks/:taskId/attachments", auth, upload.single("file"), uploadAttachment);
router.get("/attachments/:id/download", auth, downloadAttachment);
router.delete("/attachments/:id", auth, deleteAttachment);

export default router;
