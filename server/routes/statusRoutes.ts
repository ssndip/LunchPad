import { Router } from "express";
import { getStatus, updateStatus } from "../controllers/statusController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", getStatus);
router.post("/", requireAuth, updateStatus);

export default router;
