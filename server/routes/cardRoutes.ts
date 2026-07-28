import { Router } from "express";
import { rateLimit } from "express-rate-limit";
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


const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (process.env.NODE_ENV === 'test') return true;
    const clientIp = req.ip || "";
    return isWhitelisted(clientIp, settings.adminWhitelist);
  },
  message: { error: "Too many profile requests", message: "Please try again later" }
});

const router = Router();

router.get("/", requireAdmin, fetchCards);
router.post("/", requireAdmin, addOrUpdateCard);
router.post("/batch", requireAdmin, batchAddCards);
router.post("/update", requireAdmin, updateAllCards);
router.post("/reset-all", requireAdmin, resetAllBalances);
router.post("/:rfid/update", requireAdmin, updateSingleCard);
router.post("/:rfid/reset", requireAdmin, resetSingleBalance);
router.get("/:rfid/profile", profileLimiter, getCardProfile);
router.delete("/:rfid", requireAdmin, deleteCard);

export default router;
