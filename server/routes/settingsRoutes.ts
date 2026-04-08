import { Router } from "express";
import { fetchSettings, updateSettings, updatePin } from "../controllers/settingsController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, fetchSettings);
router.post("/", requireAuth, updateSettings);
router.post("/pin", requireAuth, updatePin);

export default router;
