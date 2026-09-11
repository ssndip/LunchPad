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
  updateSingleCard,
  fetchActiveRfidList
} from "../controllers/cardController";
import { requireAdmin, requireLocalOrAuth } from "../middleware/auth";

const router = Router();

router.get("/active-list", requireLocalOrAuth, fetchActiveRfidList);
router.get("/", requireAdmin, fetchCards);
router.post("/", requireAdmin, addOrUpdateCard);
router.post("/batch", requireAdmin, batchAddCards);
router.post("/update", requireAdmin, updateAllCards);
router.post("/reset-all", requireAdmin, resetAllBalances);
router.post("/:rfid/update", requireAdmin, updateSingleCard);
router.post("/:rfid/reset", requireAdmin, resetSingleBalance);
router.get("/:rfid/profile", requireLocalOrAuth, getCardProfile);
router.delete("/:rfid", requireAdmin, deleteCard);

export default router;
