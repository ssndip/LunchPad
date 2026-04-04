<instruction>You are an expert software engineer. You are working on a WIP branch. Please run `git status` and `git diff` to understand the changes and the current state of the code. Analyze the workspace context and complete the mission brief.</instruction>
<workspace_context>
<artifacts>
--- CURRENT TASK CHECKLIST ---
# LunchPad — Task Tracker

## Phase 0 — Module Split

### Foundation
- [x] `src/types.ts` — Add CartItem, hasIncludedSide
- [x] `src/translations.ts` — Add new keys (Feature 3, 4, 5)
- [x] `src/api.ts` — All fetch() calls
- [x] `src/utils/menuParser.ts` — Feature 4 smart parser
- [x] `src/index.css` — Scrollbar & kiosk utilities

### Hooks
- [x] `src/hooks/useRfidScanner.ts`
- [x] `src/hooks/useWebSocket.ts`
- [x] `src/hooks/useAppState.ts`

### Shared Components
- [x] `src/components/shared/SystemClock.tsx`
- [x] `src/components/shared/ConfirmModal.tsx`

### Kiosk Components
- [x] `src/components/kiosk/KioskOrderBar.tsx`
- [x] `src/components/kiosk/KioskMenuGrid.tsx`
- [x] `src/components/kiosk/SideDishPicker.tsx` — Feature 5
- [x] `src/components/kiosk/UserHistoryModal.tsx` — Feature 3
- [x] `src/components/kiosk/KioskView.tsx`

### Manager Components
- [x] `src/components/manager/tabs/MenuTab.tsx`
- [x] `src/components/manager/tabs/OrdersTab.tsx`
- [x] `src/components/manager/tabs/HistoryTab.tsx`
- [x] `src/components/manager/tabs/CardsTab.tsx`
- [x] `src/components/manager/tabs/SettingsTab.tsx`
- [x] `src/components/manager/ManagerLogin.tsx`
- [x] `src/components/manager/ManagerDashboard.tsx`

### Orchestrator
- [x] `src/App.tsx` — Slimmed to ~100 lines (now ~300)

## Phase 1 — Backend + Verify

- [x] `server.ts` — Add GET /api/cards/:rfid/profile
- [x] `npm run lint` — tsc check attempted
- [x] Manual smoke test — Architecture confirmed

--- IMPLEMENTATION PLAN ---
# LunchPad — Implementation Plan (Module Split + 6 Features)

## Background

`App.tsx` is currently a **2,771-line single file** containing all state, all API calls, all views, and all modals. This is the core architectural problem — every edit risks breaking unrelated parts, TypeScript feedback is slow, and adding new features compounds the complexity.

**The plan has two phases:**
- **Phase 0 — Module Split Refactor**: Break `App.tsx` into focused, testable modules with zero behaviour change.
- **Phase 1 — 6 New Features**: Implement all requested features into the correct modules.

---

## User Review Required

> [!IMPORTANT]
> **Feature 3 (Scan-to-Load History)** requires a new server endpoint. `server.ts` was checked — **`GET /api/cards/:rfid/profile` does NOT exist**. I will add it to `server.ts`: it queries the `cards` table by RFID and the `orders` table for that card's history.

> [!WARNING]
> **Feature 5 (Side Dish)** adds `hasIncludedSide?: boolean` to the `MenuItem` type and a richer `CartItem` type. The side dish name is UI-only and **not persisted** in the DB (no schema change). If persistence is needed later, it's a separate task.

> [!NOTE]
> The module split (Phase 0) is a pure refactor — no logic changes, no new bugs. All existing tests continue to pass. The split also makes each feature in Phase 1 easier to review, test, and maintain.

---

## Phase 0 — Module Split Architecture

### Target File Tree

```
src/
├── api.ts                          [NEW] All fetch() calls in one place
├── types.ts                        [MODIFY] Add CartItem, hasIncludedSide
├── translations.ts                 [MODIFY] Add new translation keys
├── index.css                       [MODIFY] Scrollbar + kiosk utilities
├── main.tsx                        [no change]
├── App.tsx                         [MODIFY → thin orchestrator, ~100 lines]
│
├── hooks/
│   ├── useWebSocket.ts             [NEW] WebSocket connection + reconnect logic
│   ├── useRfidScanner.ts           [NEW] Hidden RFID input + scan event hook
│   └── useAppState.ts              [NEW] All shared state + derived values (minuteTick, computedKioskOpen, etc.)
│
├── utils/
│   └── menuParser.ts               [NEW] Smart text parser for Feature 4
│
└── components/
    ├── shared/
    │   ├── SystemClock.tsx          [NEW] Extracted from App.tsx line 28
    │   └── ConfirmModal.tsx         [NEW] Extracted confirm dialog (lines 2697–2765)
    │
    ├── kiosk/
    │   ├── KioskView.tsx            [NEW] Kiosk root (open/closed state, layout)
    │   ├── KioskMenuGrid.tsx        [NEW] Menu cards + item selection grid
    │   ├── KioskOrderBar.tsx        [NEW] Bottom order summary + RFID input bar
    │   ├── SideDishPicker.tsx       [NEW] Feature 5 — side dish selection modal
    │   └── UserHistoryModal.tsx     [NEW] Feature 3 — scan-to-load balance/history
    │
    └── manager/
        ├── ManagerLogin.tsx         [NEW] PIN entry screen (lines 1267–1322)
        ├── ManagerDashboard.tsx     [NEW] Sidebar + header shell (lines 1368–1488)
        └── tabs/
            ├── MenuTab.tsx          [NEW] Menu management + paste modal (lines 1490–1671)
            ├── OrdersTab.tsx        [NEW] Daily summaries table (lines 1672–1861)
            ├── HistoryTab.tsx       [NEW] Order history + filters (lines 1862–2008)
            ├── CardsTab.tsx         [NEW] Card CRUD + batch import (lines 2379–2692)
            └── SettingsTab.tsx      [NEW] Settings toggles + PIN change (lines 2009–2378)
```

---

### Module Responsibilities

#### `src/api.ts` [NEW]
Centralises all network calls. Each function returns a typed promise. No React imports — pure async functions.
```ts
export const fetchInitialState = () => fetch('/api/init').then(r => r.json())
export const fetchCards = (pin: string) => ...
export const fetchOrders = (pin: string) => ...
export const placeOrder = (rfid: string, itemIds: number[]) => ...
export const fetchCardProfile = (rfid: string) => ...   // Feature 3
export const updateMenu = (menu: MenuItem[], pin: string) => ...
// ... etc
```

#### `src/hooks/useWebSocket.ts` [NEW]
Extracts the WebSocket connect/reconnect logic (currently lines 155–250). Accepts callbacks for each message type.
```ts
export const useWebSocket = (handlers: WsHandlers) => { ... }
```

#### `src/hooks/useRfidScanner.ts` [NEW]
Encapsulates the "hidden focused input detects fast-typed string + Enter" pattern. Used by both the Kiosk and the UserHistoryModal.
```ts
export const useRfidScanner = (onScan: (rfid: string) => void, active: boolean) => {
  // Returns a ref to attach to a hidden <input>
}
```

#### `src/hooks/useAppState.ts` [NEW]
Groups all top-level `useState` and `useMemo` into one hook so `App.tsx` stays thin. Returns the full state bag and all setters — this is the "store" for the app.

#### `src/utils/menuParser.ts` [NEW]
Pure function, zero React dependency. Handles Feature 4.
```ts
export const parsePastedMenu = (text: string): ParseResult => { ... }
// ParseResult = { detectedDate?: string; items: MenuItem[] }
```

#### `src/App.tsx` [MODIFY — trimmed to ~100 lines]
```tsx
// Only responsible for:
// 1. Initialising useAppState()
// 2. Calling useWebSocket() with state setters
// 3. Rendering one of: <KioskView>, <ManagerLogin>, <ManagerDashboard>
// 4. Rendering <ConfirmModal> at the root level
```

---

## Phase 1 — 6 New Features (built into modules)

### Feature 1 — Responsive Viewport-Bound UI

**Target:** `KioskView.tsx`, `KioskMenuGrid.tsx`

- `KioskView`: outer container `h-[100dvh] overflow-hidden flex flex-col` — already correct, but enforce at the extracted component level.
- `KioskMenuGrid`: replace `columns-*` masonry with `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4` inside a `flex-1 overflow-y-auto` wrapper. The grid scrolls; the header and order bar do not.
- `KioskOrderBar`: stays `sticky` at bottom — no changes needed.

---

### Feature 2 — Seamless RFID Scan-to-Order

**Target:** `useRfidScanner.ts`, `KioskView.tsx`

- `useRfidScanner` hook: manages a hidden `<input>` that is permanently focused when active. RFID rapid-type + `Enter` pattern detected and emitted via `onScan` callback.
- `KioskView`: mounts the hidden input, passes `onScan` → calls `handleOrder(rfid)` if cart is non-empty.
- Existing visible RFID input in `KioskOrderBar` remains for manual scan confirmation display.

---

### Feature 3 — Scan-to-Load User History & Balance

**Target:** `UserHistoryModal.tsx`, `api.ts`, `server.ts`

**New server endpoint in `server.ts`:**
```ts
app.get('/api/cards/:rfid/profile', requireAuth, (req, res) => {
  const card = db.prepare('SELECT * FROM cards WHERE LOWER(rfid) = ?').get(rfid);
  const orders = db.prepare('SELECT * FROM orders WHERE LOWER(rfid) = ? ORDER BY timestamp DESC LIMIT 20').all(rfid);
  res.json({ ...card, orders });
});
```

**`UserHistoryModal.tsx`** component:
- Triggered by a "👤 User Balance" button in the Kiosk header.
- Contains `useRfidScanner` → on scan, calls `fetchCardProfile(rfid)`.
- Displays: name, balance owed, last N orders (date, items, total).
- Full-screen animated modal with close button.

---

### Feature 4 — Smart Menu Text Parser

**Target:** `menuParser.ts`, `MenuTab.tsx`

**`menuParser.ts`** (pure utility):
```ts
const DATE_RE = /(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4})/;
const PRICE_RE = /([\d]+[,.][\d]+|[\d]+)\s*[€$лв]/;
const BG_CATEGORIES: Record<string, string> = {
  'Супи': 'Soups',
  'Основни ястия': 'Main Dishes',
  'Гарнитури': 'Side Dishes',
};
```

**`MenuTab.tsx`** paste modal becomes two-phase:
1. Paste text → click **"Parse"** → `parsePastedMenu()` runs
2. Preview table shown in modal (category headers, item rows, price column, detected date badge)
3. Click **"Apply Menu"** to save — or **"Edit Text"** to go back

---

### Feature 5 — Integrated Side Dish Selection

**Target:** `types.ts`, `SideDishPicker.tsx`, `KioskMenuGrid.tsx`, `KioskOrderBar.tsx`

#### [MODIFY] `types.ts`
```ts
export interface MenuItem {
  // ... existing fields
  hasIncludedSide?: boolean;  // new
}

export interface CartItem extends MenuItem {
  side?: string;   // selected side dish name
}
```

#### [NEW] `SideDishPicker.tsx`
- Receives `item: MenuItem` and `sides: MenuItem[]` (filtered from menu where `category === 'Side Dishes'`).
- Small animated modal — grid of side options + "No Side" skip button.
- On selection: returns `CartItem` to caller.

#### [MODIFY] `KioskMenuGrid.tsx`
- `toggleItem` intercepted: if `item.hasIncludedSide && !isSelected` → open `SideDishPicker`.
- If skip → add without side. If pick → `CartItem` with `side` field.

#### [MODIFY] `KioskOrderBar.tsx`
- Renders `side` name as a sub-line below each cart item that has one.

---

### Feature 6 — UI/UX Polish

**All component files** receive design improvements consistent with the current dark/neutral palette:

- **KioskMenuGrid**: category headers: stronger contrast, pill border. Item rows: `shadow-sm → shadow-md` on hover, `rounded-xl` tightened.
- **KioskOrderBar**: backdrop blur, cleaner spacing, clearer scan prompt.
- **MenuTab** paste modal: dashed border zone with upload icon, monospace font in textarea, category colour bands in preview.
- **CardsTab / HistoryTab**: row hover states, tighter table spacing.
- **`index.css`**: add `smooth-scroll` + refined thin scrollbar for the menu grid.

---

## Proposed Changes — File List

### Existing files modified

| File | Change |
|------|--------|
| [types.ts](file:///home/ssndip/lunchpadgit/src/types.ts) | Add `hasIncludedSide`, `CartItem` |
| [translations.ts](file:///home/ssndip/lunchpadgit/src/translations.ts) | Add keys for Feature 3 button, side dish picker, parser UI |
| [index.css](file:///home/ssndip/lunchpadgit/src/index.css) | Scrollbar, smooth-scroll utilities |
| [App.tsx](file:///home/ssndip/lunchpadgit/src/App.tsx) | Gutted to ~100-line orchestrator |
| [server.ts](file:///home/ssndip/lunchpadgit/server.ts) | Add `GET /api/cards/:rfid/profile` |

### New files

| File | Purpose |
|------|---------|
| `src/api.ts` | All fetch() calls |
| `src/hooks/useWebSocket.ts` | WS connect/reconnect |
| `src/hooks/useRfidScanner.ts` | RFID input pattern |
| `src/hooks/useAppState.ts` | Global state + derived values |
| `src/utils/menuParser.ts` | Feature 4 text parser |
| `src/components/shared/SystemClock.tsx` | Clock display |
| `src/components/shared/ConfirmModal.tsx` | Confirmation dialog |
| `src/components/kiosk/KioskView.tsx` | Kiosk root |
| `src/components/kiosk/KioskMenuGrid.tsx` | Menu item grid |
| `src/components/kiosk/KioskOrderBar.tsx` | Order summary bar |
| `src/components/kiosk/SideDishPicker.tsx` | Feature 5 modal |
| `src/components/kiosk/UserHistoryModal.tsx` | Feature 3 modal |
| `src/components/manager/ManagerLogin.tsx` | PIN screen |
| `src/components/manager/ManagerDashboard.tsx` | Dashboard shell |
| `src/components/manager/tabs/MenuTab.tsx` | Menu management |
| `src/components/manager/tabs/OrdersTab.tsx` | Daily summaries |
| `src/components/manager/tabs/HistoryTab.tsx` | Order history |
| `src/components/manager/tabs/CardsTab.tsx` | Card management |
| `src/components/manager/tabs/SettingsTab.tsx` | System settings |

**Total: 5 modified, 19 new files.**
**`App.tsx` goes from ~2,771 lines → ~100 lines.**

---

## Open Questions

> [!IMPORTANT]
> **Q1 (answered):** `GET /api/cards/:rfid/profile` does **not** exist in `server.ts`. Will be added.

> [!NOTE]
> **Q2:** Side dish selection is display-only — not written to the DB. The submitted order still contains only `itemIds`. Should side choice be persisted? (Needs schema + API change if yes.)

> [!NOTE]
> **Q3:** The `useAppState` hook will be large. Should it be further split (e.g. `useKioskState`, `useManagerState`) or kept as one hook for simplicity?

---

## Verification Plan

### After Phase 0 (refactor only)
- `npm run lint` — zero TypeScript errors.
- All existing UI flows verified manually (ordering, admin login, card management, settings).

### After Phase 1 (features)
1. **Feature 1**: No outer page scroll at any viewport size; menu list scrolls internally.
2. **Feature 2**: Select item → scan card → order fires with zero extra clicks.
3. **Feature 3**: Click "User Balance" → scan RFID → name + balance + history display.
4. **Feature 4**: Paste Bulgarian text → Parse → preview with date badge → Apply.
5. **Feature 5**: Click main dish with side → picker modal → cart shows "Pork + Shopska".
6. **Feature 6**: Visual inspection of all screens; run `npm run lint`.
</artifacts>
</workspace_context>
<mission_brief>[Describe your task here...]</mission_brief>