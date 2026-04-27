import { Router } from "express";
import { exportSystemBundle, importSystemBundle } from "../controllers/backupController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/backup", requireAuth, exportSystemBundle);
router.post("/restore", requireAuth, importSystemBundle);

export default router;
