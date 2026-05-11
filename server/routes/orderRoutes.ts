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
import { requireAdmin, requireAuth } from "../middleware/auth";

const router = Router();

router.get("/orders", requireAdmin, fetchOrders);
router.post("/v1/order", placeOrder); // Kiosk order
router.post("/reset", requireAdmin, resetOrders);
router.post("/distribute-fee", requireAdmin, applyDeliveryFee);
router.get("/summaries", requireAdmin, fetchSummaries);
router.get("/summaries/:date", requireAdmin, fetchSummaryDetails);
router.get("/history", requireAdmin, fetchHistory);
router.get("/analytics", requireAdmin, fetchAnalytics);

export default router;
