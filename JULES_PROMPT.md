<instruction>You are an expert software engineer. You are working on a WIP branch. Please run `git status` and `git diff` to understand the changes and the current state of the code. Analyze the workspace context and complete the mission brief.</instruction>
<workspace_context>
<artifacts>
--- CURRENT TASK CHECKLIST ---
# Admin Dashboard Refinements — Task Tracker

## 1. Foundation & API
- [x] `src/translations.ts` — Add `modals.delete_menu_warning`, `modals.delete_cards_warning`, `modals.reset_history_warning`.
- [x] `src/api.ts` — Add `resetOrders` and `deleteAllCards`.
- [x] `server.ts` — Add `DELETE /api/cards` endpoint.

## 2. Component Refinements
- [x] `src/components/manager/tabs/MenuTab.tsx` — Fix translation key & polish Delete All button.
- [x] `src/components/manager/tabs/CardsTab.tsx` — Add "Delete All Cards" button & handler.
- [x] `src/components/manager/tabs/OrdersTab.tsx` — Add "Reset History" button & handler.

## 3. Orchestration & Verification
- [x] `src/App.tsx` — Connect new handlers for reset history and delete cards.
- [x] Manual smoke test & verification.

--- IMPLEMENTATION PLAN ---
# Admin Dashboard Refinements — "Delete All" & Streamlining

This plan addresses the "continuing where we left off" request by finalizing the Menu Management streamlining and extending the "Delete All" capability to Cards and Orders for a complete administrative toolkit.

## User Review Required

> [!WARNING]
> These features are destructive. I will implement robust browser `window.confirm` checks with localized warnings to prevent accidental data loss.

> [!IMPORTANT]
> The "Delete All Menu" feature currently uses a "Reset Balances" warning in the UI due to a translation bug. This will be fixed immediately.

## Proposed Changes

### 1. Translations & API
- [NEW] Add `modals.delete_menu_warning` and `modals.delete_orders_warning` to `translations.ts`.
- [MODIFY] Add `resetOrders` and `deleteAllCards` to `src/api.ts`.

### 2. Menu Management (Refinement)
- [MODIFY] [MenuTab.tsx](file:///home/ssndip/lunchpadgit/src/components/manager/tabs/MenuTab.tsx): Fix translation key and styling of the "Delete All" button.
- [MODIFY] [App.tsx](file:///home/ssndip/lunchpadgit/src/App.tsx): Explicitly handle the empty menu state in `handleApplyMenu` to ensure sync with server.

### 3. Card Management (Extension)
- [MODIFY] [server.ts](file:///home/ssndip/lunchpadgit/server.ts): Add `DELETE /api/cards` endpoint to clear the database.
- [MODIFY] [CardsTab.tsx](file:///home/ssndip/lunchpadgit/src/components/manager/tabs/CardsTab.tsx): Add "Delete All Cards" button next to "Import Cards".

### 4. Order Management (Extension)
- [MODIFY] [OrdersTab.tsx](file:///home/ssndip/lunchpadgit/src/components/manager/tabs/OrdersTab.tsx): Add "Reset History" (Delete All Orders) button to the header.

## Verification Plan

### Automated Tests
- Test the new `DELETE /api/cards` endpoint using a simple `curl` or fetch script.
- Verify that `POST /api/menu` with `[]` correctly clears the table.

### Manual Verification
- **Menu**: Verify "Delete All" triggers the correct "Overwrite Menu" style warning.
- **Cards**: Verify "Delete All Cards" clears the registry.
- **Orders**: Verify "Reset History" clears all daily summaries and order records.
- **Overwrite**: Verify that pasting a new menu triggers the "Overwrite" warning if a menu exists, and replaces it on approval.
</artifacts>
</workspace_context>
<mission_brief>[Describe your task here...]</mission_brief>