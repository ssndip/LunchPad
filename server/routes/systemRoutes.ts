import { Router } from "express";
import { exportSystemBundle, importSystemBundle, listSystemBackups, restoreSystemBackup } from "../controllers/backupController";
import { requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/backup", requireAdmin, exportSystemBundle);
router.post("/restore", requireAdmin, importSystemBundle);

router.get("/backups", requireAdmin, listSystemBackups);
router.post("/backups/restore/:filename", requireAdmin, restoreSystemBackup);

export default router;

