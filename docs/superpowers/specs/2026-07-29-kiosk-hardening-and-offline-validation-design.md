# 🛡️ Kiosk Hardening, Offline Card Validation, and Backup Restore Design Spec

This document details the design specifications for three key production enhancements to the LunchPad canteen kiosk:
1. **Tablet Kiosk Hardening (UX Protection)**: Disabling double-tap zoom, text selection, and gesture navigation on the kiosk screen.
2. **Offline Card Validation Safeguard**: Caching valid RFIDs locally in browser `localStorage` and checking scans against it in offline mode to block invalid checkout attempts.
3. **SQLite Database Backup & Restore UI**: Exposing automated database backups in the Admin Dashboard with one-click restore (utilizing Docker auto-restart).

---

## 1. Feature Specifications & UX Flows

### 1.1. Tablet Kiosk Hardening
* **Goal**: Prevent accidental user interactions (zoom, text highlights, drags) from messing up the tablet display.
* **UX Flow**: When the kiosk interface mounts, a body class `.kiosk-mode` is added. The CSS styles disable drag-and-drop of menu images, block text selection, and disable double-tap/pinch zoom actions. On unmount, the class is cleanly removed.

### 1.2. Offline Card Validation
* **Goal**: Reject invalid card scans immediately in offline mode before they get queued.
* **UX Flow**: While online, the client periodically fetches a list of valid active card RFIDs. In offline mode, a card scan is checked against the local cache. If the card isn't registered, checkout is immediately blocked, showing an error.

### 1.3. SQLite Database Restore UI
* **Goal**: Provide an easy, one-click recovery interface for database backup restoration.
* **UX Flow**: Inside the settings page of the Admin Dashboard, a list of physical backups is shown. Clicking "Restore" next to a backup triggers a confirmation dialog. Upon confirmation, the server restores the file and restarts.

---

## 2. Technical Architecture & APIs

### 2.1. Backend Updates

#### 2.1.1. Active Cards Endpoint (`GET /api/cards/active-list`)
* **Endpoint**: `GET /api/cards/active-list` (Public/Kiosk accessible)
* **Response**: `string[]` (Flat list of valid low-cased RFID card IDs)
  ```json
  ["0412abcd", "1234567890", "test-admin"]
  ```

#### 2.1.2. Database Backups Endpoints (Admin Protected)
* **List Backups**: `GET /api/system/backups`
  * Returns list of database backup files from `data/backups/`.
  * Response format:
    ```json
    [
      {
        "filename": "lunchpad_2026-07-29T08-36-36-014Z.db",
        "sizeBytes": 163840,
        "createdAt": "2026-07-29T08:36:36.014Z"
      }
    ]
    ```
* **Restore Backup**: `POST /api/system/backups/restore/:filename`
  * Step 1: Validate admin credentials.
  * Step 2: Ensure backup file exists in the backups dir.
  * Step 3: Close the database connection: `db.close()`.
  * Step 4: Copy the backup file over the active `lunchpad.db`.
  * Step 5: Send success response: `{ success: true, message: "System restoring..." }`.
  * Step 6: Trigger exit: `setTimeout(() => process.exit(0), 500)`.
  * Step 7: Docker container automatically restarts under `restart: always`.

---

## 3. UI Modifications & Components

### 3.1. Kiosk View Updates
* **[KioskView.tsx](file:///home/ssndip/lunchpadgit/src/components/kiosk/KioskView.tsx)**:
  * Mount/unmount body class `.kiosk-mode`.
  * Cache active card RFIDs to `localStorage` under `lunchpad_valid_rfids` when online.
  * When handling `onScan`, if server connection is down, check `localStorage` cache. Block order queueing and trigger warning haptic if missing.

### 3.2. Admin Settings Updates
* **[SettingsTab.tsx](file:///home/ssndip/lunchpadgit/src/components/manager/tabs/SettingsTab.tsx)**:
  * Add a "System Database Backups" panel.
  * Fetch backups lists and map row elements with "Restore" buttons.
  * Implement confirmation modal stating that the server will temporarily restart during the database overwrite process.
