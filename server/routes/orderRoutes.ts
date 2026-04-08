import { Router } from "express";
import { 
  fetchOrders, 
  placeOrder, 
  resetOrders, 
  fetchSummaries, 
  fetchSummaryDetails, 
  fetchHistory 
} from "../controllers/orderController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, fetchOrders);
router.post("/v1/order", placeOrder); // Kiosk order
router.post("/reset", requireAuth, resetOrders);
router.get("/summaries", requireAuth, fetchSummaries);
router.get("/summaries/:date", requireAuth, fetchSummaryDetails);
router.get("/history", requireAuth, fetchHistory);

export default router;
