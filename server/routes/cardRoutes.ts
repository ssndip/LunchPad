import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import jwt from "jsonwebtoken";
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

const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 profile requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Exempt tests
    if (process.env.NODE_ENV === 'test') return true;

    // Exempt Whitelisted (Local Network / Admin IPs)
    const clientIp = req.ip || "";
    if (isWhitelisted(clientIp, settings.adminWhitelist)) {
      return true;
    }

    // Exempt Admin JWT holders
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, settings.jwtSecret) as any;
        if (decoded && decoded.role === 'admin') {
          return true;
        }
      } catch (e) {
        // invalid token, don't skip
      }
    }

    return false;
  },
  message: { error: "Too many profile requests, please try again later." }
});

router.get("/:rfid/profile", profileLimiter, getCardProfile);
router.delete("/:rfid", requireAdmin, deleteCard);

export default router;
