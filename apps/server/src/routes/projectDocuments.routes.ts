import { Router } from "express";
import {
  createMeetingMinute,
  createProjectNote,
  deleteMeetingMinute,
  deleteProjectNote,
  getMeetingMinute,
  getProjectNote,
  listMeetingMinutes,
  listProjectNotes,
  updateMeetingMinute,
  updateProjectNote
} from "../controllers/projectDocuments.controller.js";
import { upload } from "../lib/upload.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.get("/projects/:projectId/notes", auth, listProjectNotes);
router.post("/projects/:projectId/notes", auth, upload.array("files", 5), createProjectNote);
router.get("/project-notes/:id", auth, getProjectNote);
router.patch("/project-notes/:id", auth, upload.array("files", 5), updateProjectNote);
router.delete("/project-notes/:id", auth, deleteProjectNote);

router.get("/projects/:projectId/meeting-minutes", auth, listMeetingMinutes);
router.post("/projects/:projectId/meeting-minutes", auth, upload.array("files", 5), createMeetingMinute);
router.get("/meeting-minutes/:id", auth, getMeetingMinute);
router.patch("/meeting-minutes/:id", auth, upload.array("files", 5), updateMeetingMinute);
router.delete("/meeting-minutes/:id", auth, deleteMeetingMinute);

export default router;
