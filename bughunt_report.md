# 🕵️‍♂️ LunchPad Bug Hunt & Code Health Audit (Updated)

This document presents the findings from our updated project-wide code audit and bug hunt in the LunchPad repository. We have verified the status of previously reported issues and documented new findings and resolutions.

---

## ✅ 1. Previously Reported Bugs (Verified Fixed)

### 🟢 Bug 1: Unbounded Menu Backups Leak in `restoreMenuBackup`
* **Location**: [menuController.ts](file:///home/ssndip/lunchpadgit/server/controllers/menuController.ts#L161-L230)
* **Status**: **Fixed**. The controller transaction now correctly prunes backups to keep only the latest 10.

### 🟢 Bug 2: PIN Length Validation Inconsistency
* **Location**: [cardController.ts](file:///home/ssndip/lunchpadgit/server/controllers/cardController.ts)
* **Status**: **Fixed**. Standard cards now enforce 6-digit numeric checks in all creation and update routes.

### 🟢 Bug 3: Double-Tap Safeguard Blocks Test Checkout in Kiosk Test Mode
* **Location**: [orderController.ts](file:///home/ssndip/lunchpadgit/server/controllers/orderController.ts#L102-L117)
* **Status**: **Fixed**. The safeguard now bypasses validation when `settings.testModeEnabled` is active or if `card.rfid` matches `test-bypass`.

### 🟢 Bug 4: Accidental Keyboard Input Misidentification as RFID Swipe
* **Location**: [useRfidScanner.ts](file:///home/ssndip/lunchpadgit/src/hooks/useRfidScanner.ts#L57-L61)
* **Status**: **Fixed**. Implemented an average keystroke timing delay threshold check (< 100ms average delay) to distinguish hardware scanner inputs from human keyboard typing.

### 🟢 Bug 5: In-Memory Kiosk Status (`kioskOpen`)
* **Location**: [statusController.ts](file:///home/ssndip/lunchpadgit/server/controllers/statusController.ts)
* **Status**: **Fixed**. Status is now persistent in the SQLite settings database (`kiosk_open` key).

---

## 🚨 2. Newly Discovered & Resolved Bugs

### 🐛 Bug 6: Unicode & Alternation Priority Year-Truncation Bug in Menu Parser
* **Location**: [parserEngine.ts](file:///home/ssndip/lunchpadgit/src/utils/parserEngine.ts#L102-L108), [defaultParserConfig.ts](file:///home/ssndip/lunchpadgit/src/utils/defaultParserConfig.ts#L24), [advancedMenuParser.ts](file:///home/ssndip/lunchpadgit/src/utils/advancedMenuParser.ts#L26), and database seed in [db.ts](file:///home/ssndip/lunchpadgit/server/db.ts#L237).
* **Description**: 
  1. The regex used `\b` before Cyrillic keywords (e.g. `(?:\b(?:меню|дата|от|за)\s+)`). In standard JavaScript regexes, `\b` asserts a boundary between ASCII word characters (`[a-zA-Z0-9_]`) and non-word characters. Since Cyrillic letters are considered non-word characters, this word boundary constraint never matches when preceded by a space or start of line, completely breaking the Bulgarian keyword date matcher.
  2. The parser extracted `result.date = dateMatch[1]`. If the second group (Bulgarian keyword partial date like `Меню за 09.04`) matched, `dateMatch[1]` was `undefined`, setting the parsed date to `undefined` and skipping the line without recording the date.
  3. When fixing the word boundary, if a line like `"Меню за 09.04.2026"` was matched, the engine preferred matching the partial match `"за 09.04"` at index 5 because it started earlier than the full match `"09.04.2026"` at index 8. This truncated the year `2026` off full dates.
* **Impact**: **High**. Date extraction failed on standard menus using partial Bulgarian date formats (e.g., `"Меню за 09.04"`), and correcting it naively truncated the year off full dates.
* **Fix**: Unified the regex to use a lookbehind unicode word boundary and optional prefix group:
  `(?<=^|[^a-zA-Z0-9_а-яА-ЯёЁ])(?:(?:меню|дата|от|за)\s+)?(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})\b|(?<=^|[^a-zA-Z0-9_а-яА-ЯёЁ])(?:меню|дата|от|за)\s+(\d{1,2}[.\-/]\d{1,2})\b`
  and set `result.date = dateMatch[1] || dateMatch[2]` in [parserEngine.ts](file:///home/ssndip/lunchpadgit/src/utils/parserEngine.ts).

### 🐛 Bug 7: Order Reset Wipes Admin Dashboard Card List (State Sync Bug)
* **Location**: [orderController.ts](file:///home/ssndip/lunchpadgit/server/controllers/orderController.ts#L144-L160)
* **Description**: When an administrator clears orders via `/api/reset`, the server broadcasts an `INITIAL_STATE` WebSocket event. This payload included `cards: []`. When the admin dashboard received this event, it updated its local cards store state to `[]`, wiping out all listed cards from the manager UI.
* **Impact**: **Medium**. Annoying UI state bug where registered cards vanished from the admin panel until a manual page refresh.
* **Fix**: Made `cards` optional in `InitialStateMessage` type in [websocket.ts](file:///home/ssndip/lunchpadgit/src/types/websocket.ts) and omitted `cards` from the broadcast payload in `resetOrders` inside [orderController.ts](file:///home/ssndip/lunchpadgit/server/controllers/orderController.ts), preserving the existing card list on connected admin clients.
