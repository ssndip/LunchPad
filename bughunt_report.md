# 🕵️‍♂️ LunchPad Bug Hunt & Code Health Audit

This document presents the findings from an exhaustive review of the LunchPad codebase. We have identified several critical logical discrepancies, performance bottlenecks, and edge-case vulnerabilities spanning both the React frontend and Node.js Express backend.

---

## 🚨 1. High-Priority Bugs & Architectural Gaps

### 🐛 Bug A: Global Prepared Statement Leak across Multiple Databases
* **Location**: `server/controllers/menuController.ts` (Lines 22–28)
```typescript
let getMenuItemStmt: any = null;

export const getMenuItemById = (database = db, id: number) => {
  if (!getMenuItemStmt) {
    getMenuItemStmt = database.prepare("SELECT * FROM menu WHERE id = ?");
  }
  const i = getMenuItemStmt.get(id) as any;
```
* **Impact**: **Critical**. In testing environments or multi-tenant database setups, a new database connection (e.g. `:memory:`) is instantiated per test suite. Because `getMenuItemStmt` is cached as a global variable, it remains bound to the *first* database connection ever compiled. Subsequent invocations passing a different `database` reference will still run the statement on the *first* connection (which may be closed or completely empty), leading to query failures or incorrect data leaks.
* **Fix**: Do not cache the statement globally across different database instances, or cache it in a `Map<Database, Statement>` keyed by the database instance.
```typescript
export const getMenuItemById = (database = db, id: number) => {
  return database.prepare("SELECT * FROM menu WHERE id = ?").get(id) as any;
};
```

---

### 🐛 Bug B: Kiosk Auto-Timing Backend Bypass
* **Location**: `server/controllers/orderController.ts` (Line 54) vs `src/store/selectors.ts` (Lines 60–82)
* **Description**: The frontend has robust selector logic (`useComputedKioskOpen`) that automatically marks the kiosk as closed outside the configured `kioskOpenTime` and `kioskCloseTime` windows. However, the Express backend has **zero knowledge** of auto-timing properties.
* **Impact**: **High**. A client whose system clock is out of sync or a malicious script sending a POST request to `/api/v1/order` directly can place orders successfully outside canteen operating hours. The backend checkout validation *only* checks the static, manual `kioskOpen` toggle:
```typescript
if (!kioskOpen) return res.status(403).json({ error: "Kiosk is closed." });
```
* **Fix**: Synchronize `kioskAutoTiming`, `kioskOpenTime`, and `kioskCloseTime` inside the backend settings cache, and replicate the time-window check inside `placeOrder`.

---

## ⚠️ 2. Medium-Priority Inconsistencies & Edge Cases

### ⚡ Bug C: RFID Ingestion Discrepancy during Batch Insertion
* **Location**: `server/controllers/cardController.ts` (`batchAddCards` & `updateAllCards`) vs `addOrUpdateCard`
* **Description**:
  - When saving a *single card* via `addOrUpdateCard`, the RFID code is cleaned and case-normalized:
    ```typescript
    const cleanRfid = String(rfid).trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
    ```
  - When *batch importing* cards or performing bulk updates, the RFID is only trimmed:
    ```typescript
    String(c.rfid).trim()
    ```
* **Impact**: **Medium**. If an RFID contains letters (e.g., `A1B2C3`), bulk-inserted records will remain uppercase. While checkout queries utilize `LOWER(rfid) = ?`, if the RFID card code contains non-printable characters or unexpected hidden symbols (common in keyboard-emulated card readers), checkout will fail to locate the card because cleaning was omitted during batch import.
* **Fix**: Apply the same sanitization function `cleanRfid` consistently in all card ingestion routes.

---

### ⚡ Bug D: Side-Dish Validation Index Crash
* **Location**: `server/services/orderService.ts` (Lines 54–65)
```typescript
if (baseItem.requiresSideChoice || baseItem.hasIncludedSide) {
  if (!ri.side) {
    throw new Error(`Side dish required for ${baseItem.name}`);
  }
  
  if (baseItem.sideChoices && baseItem.sideChoices.length > 0) {
    if (!baseItem.sideChoices.includes(ri.side)) {
      throw new Error(`Invalid side dish "${ri.side}" for ${baseItem.name}`);
    }
  }
}
```
* **Description**: If a database item has `requiresSideChoice` set to `1` but the `sideChoices` column is `NULL` or contains an empty array, the check `baseItem.sideChoices.length > 0` might throw an error if `sideChoices` is parsed as an empty array or if `ri.side` is checked against an empty list. Furthermore, in `menuController.ts`, `sideChoices` is parsed as `JSON.parse(i.sideChoices) : []`. If the JSON string in the DB is invalid, it throws an unhandled parsing exception, crashing the query.
* **Fix**: Add a try-catch safeguard around `JSON.parse` for dynamic DB columns, and ensure `sideChoices` is validated as a non-empty array.

---

## 🔒 3. Code Security & Best Practices Audits

### 🛡️ 1. Plaintext PIN Database Storage
* **Observation**: User card PIN codes are stored in **plaintext** inside the SQLite `cards` table (`pin` column), whereas the administrative dashboard PIN is securely hashed using `bcrypt` in `server/config.ts`.
* **Risk**: High vulnerability in the event of database access leakage. An attacker acquiring `lunchpad.db` can read all active user PINs and swipe balances.
* **Recommendation**: Implement `bcrypt` hashing or a lightweight salt-hash for the 6-digit card PINs during card creation/edit, checking them with `bcrypt.compareSync` at checkout.

### 🛡️ 2. Rate Limiter IP Whitelisting Gap
* **Observation**: The rate limiter restricts API calls, but does not exempt the internal server loop or local whitelisted IP ranges automatically, which could result in administrative services being locked out during intense local kiosk order spikes.
* **Recommendation**: Exclude whitelisted IPs (`isWhitelisted`) from the rate limiter middleware explicitly.
