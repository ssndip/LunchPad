import { Router } from "express";
import rateLimit from "express-rate-limit";
import { settings } from "../config";
import { isWhitelisted } from "../middleware/whitelist";
import { 
  fetchCards, 
  addOrUpdateCard, 
  batchAddCards, 
  deleteCard, 
  updateAllCards, 
  resetAllBalances, 
  resetSingleBalance, 
  getCardProfile,
  updateSingleCard
} from "../controllers/cardController";
import { requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/", requireAdmin, fetchCards);
router.post("/", requireAdmin, addOrUpdateCard);
router.post("/batch", requireAdmin, batchAddCards);
router.post("/update", requireAdmin, updateAllCards);
router.post("/reset-all", requireAdmin, resetAllBalances);
router.post("/:rfid/update", requireAdmin, updateSingleCard);
router.post("/:rfid/reset", requireAdmin, resetSingleBalance);

const profileRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  skip: (req) => {
    if (!settings.adminWhitelistEnabled) return false;
    const clientIp = req.ip || "";
    return isWhitelisted(clientIp, settings.adminWhitelist);
  },
  message: { error: "Too many requests to profile endpoint. Please try again later." }
});

router.get("/:rfid/profile", profileRateLimiter, getCardProfile);
router.delete("/:rfid", requireAdmin, deleteCard);

export default router;
