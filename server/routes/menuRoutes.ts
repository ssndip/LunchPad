import { Router } from "express";
import { fetchMenu, updateMenu } from "../controllers/menuController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", fetchMenu);
router.post("/", requireAuth, updateMenu);

export default router;
