import { Router } from "express";
import { fetchMenu, updateMenu, fetchMenuBackups, restoreMenuBackup } from "../controllers/menuController";
import { requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/", fetchMenu);
router.post("/", requireAdmin, updateMenu);
router.get("/backups", requireAdmin, fetchMenuBackups);
router.post("/backups/restore/:id", requireAdmin, restoreMenuBackup);

export default router;
