import { Router } from "express";
import { exportSystemBundle, importSystemBundle } from "../controllers/backupController";
import { requireAdmin, requireAuth } from "../middleware/auth";

const router = Router();

router.get("/backup", requireAdmin, exportSystemBundle);
router.post("/restore", requireAdmin, importSystemBundle);

export default router;
