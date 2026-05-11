import { Router } from "express";
import { fetchMenu, updateMenu } from "../controllers/menuController";
import { requireAdmin, requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", fetchMenu);
router.post("/", requireAdmin, updateMenu);

export default router;
