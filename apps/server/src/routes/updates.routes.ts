import { Router } from "express";
import { downloadFile, getLatest } from "../controllers/updates.controller.js";

const router = Router();

router.get("/latest", getLatest);
router.get("/file", downloadFile);

export default router;
