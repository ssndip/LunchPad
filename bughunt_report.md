# 🕵️‍♂️ LunchPad Bug Hunt & Code Health Audit

This document presents the findings from an exhaustive review of the LunchPad codebase. We have identified several logical discrepancies, potential performance bottlenecks, UX edge-case vulnerabilities, and database leaks spanning both the React frontend and Node.js Express backend.

---

## 🚨 1. High & Medium-Priority Bugs

### 🐛 Bug 1: Unbounded Menu Backups Leak in `restoreMenuBackup`
* **Location**: [server/controllers/menuController.ts](file:///home/ssndip/lunchpadgit/server/controllers/menuController.ts#L161-L220)
* **Description**: While `updateMenu` correctly prunes historical backups to a limit of 10, the `restoreMenuBackup` endpoint creates a new rollback backup of the current menu state but **completely omits** the pruning step.
* **Impact**: **Medium**. Over time, repeated manual restores will lead to unbounded database growth in the `menu_backups` table, consuming unnecessary disk space.
* **Fix**: Replicate the pruning SQL query inside the transaction of `restoreMenuBackup`:
  ```typescript
  db.prepare(`
    DELETE FROM menu_backups 
    WHERE id NOT IN (
      SELECT id FROM menu_backups 
      ORDER BY timestamp DESC 
      LIMIT 10
    )
  `).run();
  ```

---

### 🐛 Bug 2: PIN Length Validation Inconsistency
* **Location**: [server/controllers/cardController.ts](file:///home/ssndip/lunchpadgit/server/controllers/cardController.ts) vs [server/controllers/orderController.ts](file:///home/ssndip/lunchpadgit/server/controllers/orderController.ts)
* **Description**: The checkout endpoint (`placeOrder`) strictly validates that a PIN must be exactly 6 digits (`if (pin.length !== 6) return res.status(400)...`). However, the card creation and editing routes (`addOrUpdateCard`, `batchAddCards`, `updateAllCards`, `updateSingleCard`) only check that `pin` is a string (if provided), allowing shorter or longer PINs to be saved.
* **Impact**: **High**. Any user who registers a card with a non-6-digit PIN (e.g. 4 digits) will have their PIN hashed and saved successfully, but will be permanently blocked from checking out with their PIN at the kiosk because the checkout handler will reject it.
* **Fix**: Enforce the 6-digit length check on PINs inside all card creation and update controllers in `cardController.ts`.

---

### 🐛 Bug 3: Double-Tap Safeguard Blocks Test Checkout in Kiosk Test Mode
* **Location**: [server/controllers/orderController.ts](file:///home/ssndip/lunchpadgit/server/controllers/orderController.ts#L101-L117)
* **Description**: The double-tap safeguard prevents duplicate charges within 3 seconds:
  ```typescript
  if (process.env.NODE_ENV !== 'test' && card && card.rfid !== 'TEST-ADMIN')
  ```
  However, when settings `testModeEnabled` is active and a user places a cardless order, the system assigns the mock RFID `test-bypass` (owner "Test Mode User"). Since `test-bypass` is not equal to `TEST-ADMIN`, placing multiple test orders in quick succession from the kiosk will trigger a `429 Duplicate Tap` response.
* **Impact**: **Medium**. Annoying blockages when developers or administrators are rapid-fire testing the ordering kiosk in test mode.
* **Fix**: Bypass the double-tap check if `settings.testModeEnabled` is active or if `card.rfid` is `test-bypass`.

---

## ⚠️ 2. UX & Interaction Vulnerabilities

### ⚡ Bug 4: Accidental Keyboard Input Misidentification as RFID Swipe
* **Location**: [src/hooks/useRfidScanner.ts](file:///home/ssndip/lunchpadgit/src/hooks/useRfidScanner.ts#L31-L70)
* **Description**: The global keyboard listener accumulates any typed characters into `bufferRef` and fires a scan when `Enter` is pressed. Because it lacks a keypress timing/speed check, if a user slowly types regular keys on the keyboard (e.g., trying to type or interact with page elements) and later presses `Enter` to confirm a modal, the scanner hook will capture the accumulated buffer as a valid RFID scan.
* **Impact**: **Medium**. Accidental trigger of RFID checks (such as displaying "Card not found" errors or triggering unwanted cart checkout behaviors) during normal keyboard navigation/interaction.
* **Fix**: Implement a keystroke timing check. Standard RFID scanners emulate keystrokes with extremely short delays (typically < 50ms per key). We can track the timestamp of the first key or the delta between keys and discard the buffer if the typing speed is too slow to be a hardware scanner.

---

## 🔒 3. Code Security & Best Practices Audits

### 🛡️ 1. In-Memory Kiosk Status (`kioskOpen`)
* **Location**: [server/controllers/statusController.ts](file:///home/ssndip/lunchpadgit/server/controllers/statusController.ts)
* **Observation**: The `kioskOpen` state is maintained as an in-memory variable (`export let kioskOpen = true;`) rather than being persisted in the SQLite `settings` table. 
* **Risk**: If the server restarts, any manual status overrides (e.g. closing the kiosk manually) are reset.
* **Recommendation**: Store `kioskOpen` in the database settings table.
