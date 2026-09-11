import { Request, Response } from 'express';
import { db } from '../db';
import { initSettings, settings } from '../config';
import { broadcast } from '../broadcast';
import { getMenu } from './menuController';
import { kioskOpen, loadKioskStatus } from './statusController';

const TABLES = [
  'cards',
  'menu',
  'orders',
  'daily_summaries',
  'settings',
  'parser_profiles',
  'parser_versions',
  'parser_fixtures',
  'custom_languages'
];

/**
 * Settings deliberately left out of an exported bundle.
 *
 * `jwt_secret` signs dashboard sessions, so anyone holding it can mint an admin
 * token without knowing the PIN. It is the one secret here a restore does not
 * need: `initSettings` generates a fresh one when the row is absent, and the
 * only consequence is that sessions open at the time of the restore have to log
 * in again. Shipping it meant a backup file — which by its nature gets copied to
 * a laptop, a share, an email — was a permanent skeleton key to the dashboard.
 *
 * `pin_pepper` is NOT excluded, and must not be: card PIN digests are HMACs
 * under it, so a bundle restored without it would leave every cardholder unable
 * to pay. That is the trade this file is making explicitly rather than by
 * accident — a backup still holds material worth protecting, just not the
 * session-signing key on top of it.
 */
const EXPORT_EXCLUDED_SETTINGS = new Set(['jwt_secret']);

export const exportSystemBundle = (req: Request, res: Response) => {
  try {
    const bundle: any = {
      type: 'LUNCHPAD_FULL_SYSTEM_SNAPSHOT',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: {}
    };

    for (const table of TABLES) {
      const rows = db.prepare(`SELECT * FROM ${table}`).all() as any[];
      bundle.data[table] = table === 'settings'
        ? rows.filter(row => !EXPORT_EXCLUDED_SETTINGS.has(row?.key))
        : rows;
    }

    // This body carries card PIN digests and the PIN pepper. Keep it out of
    // every cache between here and the administrator's disk, and hand it to the
    // browser as a download rather than something to render inline.
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Content-Disposition',
      `attachment; filename="lunchpad_backup_${new Date().toISOString().split('T')[0]}.json"`);
    res.json(bundle);
  } catch (err: any) {
    console.error('[Backup] Export failed:', err);
    res.status(500).json({ error: 'Failed to generate system backup: ' + err.message });
  }
};

export const importSystemBundle = (req: Request, res: Response) => {
  const bundle = req.body;
  if (!bundle || bundle.type !== 'LUNCHPAD_FULL_SYSTEM_SNAPSHOT') {
    return res.status(400).json({ error: 'Invalid backup format' });
  }
  if (!bundle.data || typeof bundle.data !== 'object' || Array.isArray(bundle.data)) {
    return res.status(400).json({ error: 'Invalid backup format: missing data' });
  }

  // Only tables the bundle actually carries are touched. The loop used to
  // DELETE every table before looking at what was in the bundle, so a bundle
  // that omitted one emptied it and committed — and an omitted `settings`
  // meant losing `pin_pepper` (making every card PIN hash unverifiable) and
  // `admin_pin` (dropping the dashboard back to the default PIN).
  // A table present but empty is an explicit "this was empty", and is honoured.
  const tablesToRestore = TABLES.filter(table => bundle.data[table] !== undefined);

  // Validated up front so a malformed bundle is refused before any row is
  // deleted, rather than surfacing as a 500 halfway through.
  for (const table of tablesToRestore) {
    if (!Array.isArray(bundle.data[table])) {
      return res.status(400).json({ error: `Invalid backup format: "${table}" is not an array` });
    }
  }
  if (tablesToRestore.length === 0) {
    return res.status(400).json({ error: 'Invalid backup format: no known tables present' });
  }

  // Disable foreign keys on the connection BEFORE starting the transaction
  db.pragma('foreign_keys = OFF');

  const restored: Record<string, number> = {};

  try {
    const transaction = db.transaction(() => {
      for (const table of tablesToRestore) {
        const tableData = bundle.data[table] as any[];

        db.prepare(`DELETE FROM ${table}`).run();
        restored[table] = tableData.length;
        if (tableData.length === 0) continue;

        // 2. Fetch valid column names in the current database schema to support divergent backups
        const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
        const validColumns = new Set(tableInfo.map((c: any) => c.name));

        // Union of keys across every row, not just the first: a bundle whose
        // first row happened to omit a nullable column previously decided the
        // column list for the whole table, and later rows bound `undefined`.
        const columns = [...new Set(tableData.flatMap(row => Object.keys(row || {})))]
          .filter(col => validColumns.has(col));
        if (columns.length === 0) continue;

        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
        const insertStmt = db.prepare(sql);

        for (const row of tableData) {
          // `undefined` is not bindable; a column this row lacks is NULL.
          const values = columns.map(col => (row?.[col] === undefined ? null : row[col]));
          insertStmt.run(...values);
        }
      }
    });

    transaction();

    // The process still holds the pre-restore config in memory — menuVersion,
    // fees, the JWT secret — so without this it keeps serving the old values
    // until someone restarts it. initSettings also re-seeds anything the
    // restored bundle left missing.
    initSettings();
    loadKioskStatus();

    // Connected kiosks are still showing the old menu against the old version,
    // which would make their next order fail the version check.
    broadcast({
      type: "MENU_UPDATE",
      menu: getMenu(db),
      version: settings.menuVersion,
      menuDate: settings.menuDate
    });
    broadcast({ type: "STATUS_UPDATE", kioskOpen });

    res.json({ success: true, message: 'System restored successfully', restored });
  } catch (err: any) {
    console.error('[Backup] Restore failed:', err);
    res.status(500).json({ error: 'System restore failed: ' + err.message });
  } finally {
    // Re-enable foreign keys
    db.pragma('foreign_keys = ON');
  }
};

import fs from 'fs';
import path from 'path';

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

    if (!filename || path.basename(filename) !== filename || !filename.endsWith('.db')) {
      return res.status(404).json({ error: "Backup file not found" });
    }

    const DB_DIR = process.env.NODE_ENV === 'production' ? '/app/data' : '.';
    const backupsDir = path.join(DB_DIR, 'backups');
    const backupPath = path.join(backupsDir, filename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: "Backup file not found" });
    }

    const activeDbPath = process.env.NODE_ENV === 'test' ? ':memory:' : path.join(DB_DIR, 'lunchpad.db');

    try {
      db.close();
      fs.copyFileSync(backupPath, activeDbPath);
    } catch (copyErr: any) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('[Backup] Failed to restore database file:', copyErr);
        process.exit(1);
      }
      throw copyErr;
    }

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


export const initAutoBackup = () => {
  // Only activate automated backups if not running in a test suite
  if (process.env.NODE_ENV === 'test') return;

  const DB_DIR = process.env.NODE_ENV === 'production' ? '/app/data' : '.';
  const backupsDir = path.join(DB_DIR, 'backups');

  const performBackup = async () => {
    try {
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupsDir, `lunchpad_${timestamp}.db`);

      console.log(`[Auto-Backup] Starting online SQLite backup to: ${backupPath}`);
      await db.backup(backupPath);
      console.log(`[Auto-Backup] Database successfully backed up to: ${backupPath}`);

      // Prune old backups (Keep only latest 7 copies)
      const files = fs.readdirSync(backupsDir)
        .filter(f => f.startsWith('lunchpad_') && f.endsWith('.db'))
        .map(f => ({ name: f, path: path.join(backupsDir, f), mtime: fs.statSync(path.join(backupsDir, f)).mtime.getTime() }))
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length > 7) {
        for (let i = 7; i < files.length; i++) {
          fs.unlinkSync(files[i].path);
          console.log(`[Auto-Backup] Pruned old backup file: ${files[i].name}`);
        }
      }
    } catch (err) {
      console.error('[Auto-Backup] Failed to run automated backup:', err);
    }
  };

  // Run initial backup after 5 seconds, then every 24 hours
  setTimeout(() => {
    performBackup();
  }, 5000);

  setInterval(() => {
    performBackup();
  }, 24 * 60 * 60 * 1000);
};


