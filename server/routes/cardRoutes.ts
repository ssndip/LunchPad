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
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, fetchCards);
router.post("/", requireAuth, addOrUpdateCard);
router.post("/batch", requireAuth, batchAddCards);
router.post("/update", requireAuth, updateAllCards);
router.post("/reset-all", requireAuth, resetAllBalances);
router.post("/:rfid/update", requireAuth, updateSingleCard);
router.post("/:rfid/reset", requireAuth, resetSingleBalance);
router.get("/:rfid/profile", getCardProfile);
router.delete("/:rfid", requireAuth, deleteCard);

export default router;
