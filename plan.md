# 📋 LunchPad Future Improvements Plan

This document establishes a **strategic technical roadmap** for the LunchPad Canteen Management System. It categorizes high-impact backend security hardening, architectural optimizations, state synchronization enhancements, and premium UI/UX refinements to guide future developer iterations.

---

## 🛠️ 1. Security & Data Integrity Hardening

### 🔒 A. Secure Card PIN Hashing
*   **Current State**: User card PINs (6 digits) are stored in **plaintext** inside the SQLite `cards` table (`pin` column), whereas the administrative PIN is securely hashed using `bcrypt`.
*   **Risk**: High. In the event of a database leak, an attacker acquiring `lunchpad.db` can read all active card numbers, swipe balances, and administrative permissions.
*   **Suggested Action**:
    1.  Integrate `bcryptjs` or lightweight salt-hashing into card registration (`addCard`) and editing routes.
    2.  Migrate existing plaintext pins securely on startup.
    3.  Leverage `bcrypt.compareSync` within the checkout authentication hook.

### 📅 B. Backend Kiosk Timing Synchronization
*   **Current State**: The React frontend prevents orders outside operating hours using the `useComputedKioskOpen` selector. However, the Express backend checkout validator only checks the static, manual `kioskOpen` toggle:
    ```typescript
    if (!kioskOpen) return res.status(403).json({ error: "Kiosk is closed." });
    ```
*   **Risk**: A user with an out-of-sync local system clock, or an external script firing POST requests directly to `/api/v1/order`, can successfully place orders outside allowed operating hours.
*   **Suggested Action**:
    1.  Store operating windows (`kioskAutoTiming`, `kioskOpenTime`, `kioskCloseTime`) securely inside the backend settings database.
    2.  Validate incoming timestamps against these backend constraints inside the `placeOrder` transaction.

### 🔍 C. Normalized RFID Data Ingestion
*   **Current State**: Registering a *single* card cleanses and case-normalizes RFID values (removing non-printable symbols and converting to lower-case). However, *batch imports* (`batchAddCards`) only trim whitespace, leaving uppercase characters or hidden scanner noises in the database.
*   **Risk**: Inconsistent lookups. A batch-imported card like `A1B2C3` will fail checks that search for `a1b2c3` or rely on keyboard scanner sanitization.
*   **Suggested Action**:
    1.  Isolate the sanitization logic into a utility helper:
        ```typescript
        export const cleanRfid = (rfid: string) => rfid.trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
        ```
    2.  Enforce this utility across all single, bulk, and spreadsheet ingestion pipelines.

---

## ⚡ 2. Performance & Architecture Optimizations

### 💾 A. Dynamic Prepared Statement Caching
*   **Current State**: Prepared statements inside database controller files (e.g. `menuController.ts`) are stored as global variables:
    ```typescript
    let getMenuItemStmt: any = null;
    ```
*   **Risk**: In multi-tenant environments or isolated test runners where databases are created dynamically in-memory per suite, statements remain bound to the *first* database ever compiled, leaking data or crashing queries.
*   **Suggested Action**:
    1.  Cache compiled statements inside a `Map<Database, Statement>` keyed by active database instances:
        ```typescript
        const statementCache = new Map<Database, Statement>();
        ```
    2.  Or re-prepare statements inside transactional closures to safeguard multi-database boundaries.

### 🚀 B. Whitelisted IP Rate Limiter Exclusions
*   **Current State**: The Express API rate limiter restricts requests globally, which can trigger `429 Too Many Requests` blockages on highly-active kiosk terminals during checkout rushes.
*   **Suggested Action**:
    1.  Explicitly bypass local and whitelisted loopback IP ranges (`::1`, `127.0.0.1`) inside the rate-limiting middleware.
    2.  Implement high-priority queues for native physical terminals.

---

## 📦 3. State & Sync Resilience

### 📶 A. LocalStorage-Backed Offline State Queue
*   **Current State**: Actions executed offline are queued in-memory via `useSyncState.ts`.
*   **Risk**: If a tablet is reloaded, experiences a power interruption, or the browser tab closes while offline, all pending checkout transactions vanish.
*   **Suggested Action**:
    1.  Serialize the offline synchronization queue to HTML5 `localStorage` or `indexedDB` on change.
    2.  On app mount, rehydrate the queue and automatically resume batch submissions once network availability is detected.

### 🔌 B. Automated WebSocket Reconnect Backoff
*   **Current State**: Re-establishing lost WebSocket connections relies on periodic interval retries.
*   **Suggested Action**:
    1.  Implement an **Exponential Backoff with Jitter** retry pattern (`1s`, `2s`, `4s`, `8s` + random offsets) to prevent thundering-herd issues on the server when a network router restarts.

---

## 🎨 4. Premium UI/UX & Interaction Refinements

### 🧭 A. Tablet Navigation Swipe-Fade Indicator
*   **Current State**: On portrait tablets, the manager dashboard navigation bar (`TabletNav`) scrollbar is hidden using `no-scrollbar`. If tabs overflow, there is no visual clue that more options are available.
*   **Suggested Action**:
    1.  Overlay a subtle, translucent CSS gradient fade on the right/left edges of the tab bar.
    2.  Hide the fade dynamically when the user scrolls to the absolute limits of the container.

### 📱 B. Dynamic Haptic Preferences Selector
*   **Current State**: Haptic feedbacks (`triggerHaptic`) fire standard vibration patterns globally on Android devices.
*   **Suggested Action**:
    1.  Provide managers with an administrative toggle under System Settings to choose haptic feedback levels (`Disabled`, `Light`, `Default`, `Robust`).

### 📊 C. SVG Analytics Export & Print Styles
*   **Current State**: Managers view interactive analytics via Recharts, but exporting them involves general page printouts.
*   **Suggested Action**:
    1.  Add native SVG/PNG canvas export buttons to the `AnalyticsTab` charts.
    2.  Utilize Tailwind `@media print` utilities to isolate cleanly formatted spreadsheets for physical printers.
