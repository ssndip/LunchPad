# Task 3 Report: SQLite Database Backup & Restore (Backend)

## Status
DONE

## Summary of Changes
- **`server/controllers/backupController.ts`**:
  - Implemented `listSystemBackups` endpoint handler to scan the database backups directory (`./backups` or `/app/data/backups`), filter `lunchpad_*.db` backup files, extract size and creation time stats, and return sorted array (newest first).
  - Implemented `restoreSystemBackup` endpoint handler to validate requested filename, close active SQLite connection (`db.close()`), copy backup file onto active database path, and return success status with server restart warning.
- **`server/routes/systemRoutes.ts`**:
  - Registered `GET /backups` (`requireAdmin`, `listSystemBackups`).
  - Registered `POST /backups/restore/:filename` (`requireAdmin`, `restoreSystemBackup`).
- **`server/controllers/backupController.test.ts`**:
  - Created unit tests verifying backup list generation, sorting, missing directory fallbacks, invalid filename handling (404), and successful database file restoration.

## Verification
- Ran `npx vitest run server/controllers/backupController.test.ts`:
  - Verified test failure before implementation (Step 2).
  - Verified test passing after implementation (Step 4, 4/4 tests passed).
- Ran full test suite `npx vitest run`:
  - All 23 test suites (120 tests) passed clean.
- Committed changes: `feat: add active system backup listing and physical database restore endpoints`.

## Security & Safety Fixes (Code Review Feedback)
- **Path Traversal Mitigation**: Enforced `path.basename(filename) === filename` check in `restoreSystemBackup` before resolving paths, preventing directory traversal attacks.
- **Copy Failure Safety**: Placed `db.close()` immediately before `fs.copyFileSync()` in a dedicated try-catch block; if `copyFileSync` fails outside of testing, `process.exit(1)` is triggered to prevent running with a closed unrecoverable DB connection.
- **Added Security Tests**: Added test cases for path traversal rejection and copy error handling in `server/controllers/backupController.test.ts`.
- **Verification**: Re-ran `vitest` (6/6 tests passed in `backupController.test.ts`, all 122 tests passed overall).

