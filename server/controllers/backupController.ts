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

  try {
    const transaction = db.transaction(() => {
      // 1. Truncate all tables (Careful: Order matters for foreign keys, but we use PRAGMA foreign_keys=OFF)
      db.pragma('foreign_keys = OFF');
      
      for (const table of TABLES) {
        db.prepare(`DELETE FROM ${table}`).run();
        
        const tableData = bundle.data[table];
        if (!tableData || tableData.length === 0) continue;

        // 2. Generate dynamic insert statement
        const columns = Object.keys(tableData[0]);
        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
        const insertStmt = db.prepare(sql);

        for (const row of tableData) {
          const values = columns.map(col => row[col]);
          insertStmt.run(...values);
        }
      }
      
      db.pragma('foreign_keys = ON');
    });

    transaction();
    res.json({ success: true, message: 'System restored successfully' });
  } catch (err: any) {
    console.error('[Backup] Restore failed:', err);
    res.status(500).json({ error: 'System restore failed: ' + err.message });
  }
};
