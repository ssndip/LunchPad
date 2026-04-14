import { Router } from "express";
import { 
  fetchOrders, 
  placeOrder, 
  resetOrders, 
  fetchSummaries, 
  fetchSummaryDetails, 
  fetchHistory,
  fetchAnalytics,
  applyDeliveryFee
} from "../controllers/orderController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/orders", requireAuth, fetchOrders);
router.post("/v1/order", placeOrder); // Kiosk order
router.post("/reset", requireAuth, resetOrders);
router.post("/distribute-fee", requireAuth, applyDeliveryFee);
router.get("/summaries", requireAuth, fetchSummaries);
router.get("/summaries/:date", requireAuth, fetchSummaryDetails);
router.get("/history", requireAuth, fetchHistory);
router.get("/analytics", requireAuth, fetchAnalytics);

export default router;
