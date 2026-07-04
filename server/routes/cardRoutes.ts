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
import { profileRateLimiter } from "../middleware/rateLimit";

const router = Router();

router.get("/", requireAdmin, fetchCards);
router.post("/", requireAdmin, addOrUpdateCard);
router.post("/batch", requireAdmin, batchAddCards);
router.post("/update", requireAdmin, updateAllCards);
router.post("/reset-all", requireAdmin, resetAllBalances);
router.post("/:rfid/update", requireAdmin, updateSingleCard);
router.post("/:rfid/reset", requireAdmin, resetSingleBalance);
router.get("/:rfid/profile", profileRateLimiter, getCardProfile);
router.delete("/:rfid", requireAdmin, deleteCard);

export default router;
