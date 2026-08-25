import { Router } from "express";
import { addToActivity, getAllActivity, getTranscript, login, register, saveTranscript, summarizeMeeting } from "../controllers/user.controller.js";

const router = Router();

router.post("/login", login);
router.post("/register", register);
router.post("/add_to_activity", addToActivity);
router.get("/get_all_activity", getAllActivity);
router.post("/save_transcript", saveTranscript);
router.get("/get_transcript", getTranscript);
router.post("/summarize_meeting", summarizeMeeting);

export default router;