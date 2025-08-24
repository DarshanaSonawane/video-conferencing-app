import { Router } from "express";
import { login, register } from "../controllers/user.controller.js"; // go up one level

const router = Router();

router.post("/login", login);
router.post("/register", register);

// Example activity routes (placeholders)
router.post("/add_to_activity", (req, res) => {
    res.json({ message: "Activity added" });
});
router.get("/get_all_activity", (req, res) => {
    res.json({ message: "All activities returned" });
});

export default router;
