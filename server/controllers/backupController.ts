import { Request, Response } from 'express';
import { db } from '../db';

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

export const exportSystemBundle = (req: Request, res: Response) => {
  try {
    const bundle: any = {
      type: 'LUNCHPAD_FULL_SYSTEM_SNAPSHOT',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: {}
    };

    for (const table of TABLES) {
      bundle.data[table] = db.prepare(`SELECT * FROM ${table}`).all();
    }

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

  // Disable foreign keys on the connection BEFORE starting the transaction
  db.pragma('foreign_keys = OFF');

  try {
    const transaction = db.transaction(() => {
      for (const table of TABLES) {
        db.prepare(`DELETE FROM ${table}`).run();
        
        const tableData = bundle.data[table];
        if (!tableData || tableData.length === 0) continue;

        // 2. Fetch valid column names in the current database schema to support divergent backups
        const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
        const validColumns = tableInfo.map((c: any) => c.name);
        const columns = Object.keys(tableData[0]).filter(col => validColumns.includes(col));
        if (columns.length === 0) continue;

        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
        const insertStmt = db.prepare(sql);

        for (const row of tableData) {
          const values = columns.map(col => row[col]);
          insertStmt.run(...values);
        }
      }
    });

    transaction();
    res.json({ success: true, message: 'System restored successfully' });
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

