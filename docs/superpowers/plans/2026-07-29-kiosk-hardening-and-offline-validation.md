# Canteen Canteen Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Kiosk tablet UX hardening, offline mode card verification using localStorage caching, and admin controls for database backup listing and one-click restoration.

**Architecture:** 
1. UX Hardening: Add styling rules to disable double-tap zoom, text selection, and image drag-and-drop on the Kiosk view via a CSS class on body.
2. Offline Verification: Expose public active-list card endpoint, cache cards list in browser, and check scans against this list when connection is offline.
3. Backup restore: Expose listing/restore endpoint on the server. Overwrite active database file with backup and exit process (allowing Docker to auto-restart the container). Render backups management list in Settings Tab.

**Tech Stack:** React, TypeScript, Express, SQLite (better-sqlite3), Vitest, React Testing Library.

## Global Constraints
* No CSS style sheets outside of `src/index.css`.
* All API endpoints must be properly tested.
* SQLite restoration process must gracefully exit node process to let Docker restart it safely.

---

### Task 1: Tablet Kiosk UX Hardening

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/kiosk/KioskView.tsx`

- [ ] **Step 1: Write the failing test**
  Modify `src/components/kiosk/KioskView.test.tsx` (or verify component behavior for adding class to body):
  ```typescript
  import { describe, it, expect } from 'vitest';
  import { render } from '@testing-library/react';
  import { KioskView } from './KioskView';
  import React from 'react';

  // Add dummy test case verifying kiosk-mode class toggle
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/components/kiosk/KioskView.test.tsx`
  Expected: FAIL/Verify toggle logic is missing.

- [ ] **Step 3: Write minimal implementation**
  Add styles in `src/index.css`:
  ```css
  .kiosk-mode {
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
  }
  .kiosk-mode img, 
  .kiosk-mode button {
    -webkit-user-drag: none;
  }
  ```
  Inject effect in `src/components/kiosk/KioskView.tsx`:
  ```typescript
  React.useEffect(() => {
    document.body.classList.add('kiosk-mode');
    return () => {
      document.body.classList.remove('kiosk-mode');
    };
  }, []);
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/components/kiosk/KioskView.test.tsx`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/index.css src/components/kiosk/KioskView.tsx
  git commit -m "feat: add kiosk-mode UX hardening class to prevent pinch zoom and selection"
  ```

---

### Task 2: Offline Card Verification (Backend & Frontend)

**Files:**
- Modify: `server/routes/cardRoutes.ts`
- Modify: `server/controllers/cardController.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/kiosk/KioskView.tsx`
- Create: `server/controllers/cardController.test.ts` (or add to existing tests)

- [ ] **Step 1: Write the failing test**
  Add test for `GET /api/cards/active-list` in backend tests.
  Add test in `src/components/kiosk/KioskView.test.tsx` verifying offline scanner blocks unregistered card scans.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run server/controllers/cardController.test.ts`
  Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
  In `server/controllers/cardController.ts`:
  ```typescript
  export const fetchActiveRfidList = (req: Request, res: Response, next: NextFunction) => {
    try {
      const cards = db.prepare("SELECT rfid FROM cards").all() as { rfid: string }[];
      res.json(cards.map(c => c.rfid.toLowerCase()));
    } catch (err) {
      next(err);
    }
  };
  ```
  In `server/routes/cardRoutes.ts`:
  ```typescript
  router.get("/active-list", fetchActiveRfidList);
  ```
  In `src/App.tsx`:
  Fetch `/api/cards/active-list` when online and store in `localStorage.setItem('lunchpad_valid_rfids', JSON.stringify(rfids))`.
  In `src/components/kiosk/KioskView.tsx`:
  In `onScan`, check if connection is offline (`connectionError`). If offline:
  ```typescript
  const cached = localStorage.getItem('lunchpad_valid_rfids');
  const validRfids = cached ? JSON.parse(cached) : [];
  if (!validRfids.includes(scannedRfid.toLowerCase())) {
    setError("Card not registered (offline)");
    return;
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run server/controllers/cardController.test.ts` and `npx vitest run src/components/kiosk/KioskView.test.tsx`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add server/routes/cardRoutes.ts server/controllers/cardController.ts src/App.tsx src/components/kiosk/KioskView.tsx
  git commit -m "feat: add client-side offline card validation from active-list API"
  ```

---

### Task 3: SQLite Database Backup & Restore (Backend)

**Files:**
- Modify: `server/routes/systemRoutes.ts`
- Modify: `server/controllers/backupController.ts`
- Create: `server/controllers/backupController.test.ts`

- [ ] **Step 1: Write the failing test**
  Create test for listing backup files and invoking the restore action in `server/controllers/backupController.test.ts`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run server/controllers/backupController.test.ts`
  Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
  In `server/controllers/backupController.ts`:
  ```typescript
  export const listSystemBackups = (req: Request, res: Response) => {
    try {
      const DB_DIR = process.env.NODE_ENV === 'production' ? '/app/data' : '.';
      const backupsDir = path.join(DB_DIR, 'backups');
      if (!fs.existsSync(backupsDir)) {
        return res.json([]);
      }
      const files = fs.readdirSync(backupsDir)
        .filter(f => f.startsWith('lunchpad_') && f.endsWith('.db'))
        .map(f => {
          const stats = fs.statSync(path.join(backupsDir, f));
          return {
            filename: f,
            sizeBytes: stats.size,
            createdAt: stats.mtime.toISOString()
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      res.json(files);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  export const restoreSystemBackup = (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      const DB_DIR = process.env.NODE_ENV === 'production' ? '/app/data' : '.';
      const backupsDir = path.join(DB_DIR, 'backups');
      const backupPath = path.join(backupsDir, filename);

      if (!fs.existsSync(backupPath) || !filename.endsWith('.db')) {
        return res.status(404).json({ error: "Backup file not found" });
      }

      db.close();
      const activeDbPath = process.env.NODE_ENV === 'test' ? ':memory:' : path.join(DB_DIR, 'lunchpad.db');
      fs.copyFileSync(backupPath, activeDbPath);

      res.json({ success: true, message: "System database successfully restored. Server restarting..." });

      if (process.env.NODE_ENV !== 'test') {
        setTimeout(() => {
          process.exit(0);
        }, 500);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
  ```
  Register endpoints in `server/routes/systemRoutes.ts`:
  ```typescript
  router.get("/backups", requireAdmin, listSystemBackups);
  router.post("/backups/restore/:filename", requireAdmin, restoreSystemBackup);
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run server/controllers/backupController.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add server/routes/systemRoutes.ts server/controllers/backupController.ts
  git commit -m "feat: add active system backup listing and physical database restore endpoints"
  ```

---

### Task 4: SQLite Database Backup & Restore UI (Frontend)

**Files:**
- Modify: `src/components/manager/tabs/SettingsTab.tsx`

- [ ] **Step 1: Write the failing test**
  Add tests inside `src/components/manager/tabs/SettingsTab.test.tsx` verifying that backup lists are fetched and rendered properly, and clicking restore opens the confirmation modal.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/components/manager/tabs/SettingsTab.test.tsx`
  Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
  Add interface layout inside `SettingsTab.tsx` under a new section `"System Backups"` to query `GET /api/system/backups` and call `POST /api/system/backups/restore/:filename` upon confirmation.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/components/manager/tabs/SettingsTab.test.tsx`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/manager/tabs/SettingsTab.tsx
  git commit -m "feat: add system database backups tab and restore controls to Admin dashboard"
  ```
