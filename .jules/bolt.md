## 2024-04-16 - Add Index on orders.date
**Learning:** Frequent backend operations (like `fetchSummaryDetails` and `applyDeliveryFee`) were relying on full table scans to filter orders by `date` (e.g., `SELECT DISTINCT rfid FROM orders WHERE date = ?`), which degrades performance linearly as the database grows.
**Action:** Always verify index coverage for all columns used frequently in `WHERE` clauses, especially for time-series or analytics tables where the data volume grows indefinitely.
