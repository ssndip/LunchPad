import { Router } from "express";
import { getStatus, updateStatus } from "../controllers/statusController";
import { requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/", getStatus);
router.post("/", requireAdmin, updateStatus);

export default router;
