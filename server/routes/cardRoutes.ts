import { Router } from "express";
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
import { rateLimit } from "express-rate-limit";
import { isWhitelisted } from "../middleware/whitelist";
import { settings } from "../config";
import { logger } from "../logger";

const router = Router();

const profileLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // Limit each IP to 30 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  skip: (req) => {
    if (process.env.NODE_ENV === 'test') return false;
    const clientIp = req.ip || "";
    return isWhitelisted(clientIp, settings.adminWhitelist);
  },
  message: { error: "Too many profile requests", message: "Please try again later" },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit hit: Card profile endpoint from IP ${req.ip}`);
    res.status(options.statusCode).json(options.message);
  }
});

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
