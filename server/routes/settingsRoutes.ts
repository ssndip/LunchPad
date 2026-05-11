import { Router } from "express";
import { fetchSettings, updateSettings, updatePin } from "../controllers/settingsController";
import { requireAdmin, requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAdmin, fetchSettings);
router.post("/", requireAdmin, updateSettings);
router.post("/pin", requireAdmin, updatePin);

export default router;
