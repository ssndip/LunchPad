import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { broadcast } from "../broadcast";
import { incrementMenuVersion, settings } from "../config";

const safeParseJSON = (jsonStr: string, fallback: any = []) => {
  if (!jsonStr) return fallback;
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return fallback;
  }
};

export const getMenu = (database = db) => {
  const items = database.prepare("SELECT * FROM menu").all() as any[];
  return items.map(i => ({ 
    ...i, 
    available: i.available === 1,
    requiresSideChoice: i.requiresSideChoice === 1,
    hasIncludedSide: i.hasIncludedSide === 1,
    sideChoices: safeParseJSON(i.sideChoices, []),
    tags: safeParseJSON(i.tags, []),
    packagingFee: i.packagingFee,
    date: i.date,
    menuVersion: settings.menuVersion,
    menuDate: settings.menuDate
  }));
};

export const getMenuItemById = (database = db, id: number) => {
  const i = database.prepare("SELECT * FROM menu WHERE id = ?").get(id) as any;
  if (!i) return null;

  return {
    ...i,
    available: i.available === 1,
    requiresSideChoice: i.requiresSideChoice === 1,
    hasIncludedSide: i.hasIncludedSide === 1,
    sideChoices: safeParseJSON(i.sideChoices, []),
    tags: safeParseJSON(i.tags, []),
    packagingFee: i.packagingFee,
    date: i.date,
    menuVersion: settings.menuVersion,
    menuDate: settings.menuDate
  };
};

export const fetchMenu = (req: Request, res: Response) => {
  res.json(getMenu(db));
};

export const updateMenu = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items, date } = req.body;
    const finalItems = Array.isArray(items) ? items : (Array.isArray(req.body) ? req.body : null);
    
    if (!finalItems) {
      return res.status(400).json({ error: "Expected an array of menu items" });
    }

    // Validate each menu item before saving to prevent negative or non-numeric prices
    for (const i of finalItems) {
      if (!i.name || typeof i.name !== 'string') {
        return res.status(400).json({ error: "Each menu item must have a valid name" });
      }
      const price = Number(i.price);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({ error: `Invalid price for item "${i.name}": must be a valid non-negative number` });
      }
    }

    db.transaction(() => {
      // Create auto-recovery backup before updating
      const prevMenu = getMenu(db);
      if (prevMenu && prevMenu.length > 0) {
        const timestamp = new Date().toISOString();
        db.prepare(`
          INSERT INTO menu_backups (timestamp, menuDate, menuData, menuVersion)
          VALUES (?, ?, ?, ?)
        `).run(timestamp, settings.menuDate || "", JSON.stringify(prevMenu), settings.menuVersion);
        
        // Prune backups: Keep only the latest 10 backups
        db.prepare(`
          DELETE FROM menu_backups 
          WHERE id NOT IN (
            SELECT id FROM menu_backups 
            ORDER BY timestamp DESC 
            LIMIT 10
          )
        `).run();
      }

      // Save menuDate if provided (Global fallback/header)
      if (date !== undefined) {
        settings.menuDate = date || "";
        db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
          .run("menu_date", settings.menuDate);
      }

      db.prepare("DELETE FROM menu").run();
      const insert = db.prepare(`
        INSERT INTO menu (
          id, name, description, price, available, category, 
          requiresSideChoice, sideChoices, selectedSide, hasIncludedSide,
          tags, packagingFee, date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      finalItems.forEach((i: any) => insert.run(
        i.id, 
        i.name, 
        i.description, 
        i.price, 
        i.available ? 1 : 0, 
        i.category,
        i.requiresSideChoice ? 1 : 0,
        i.sideChoices ? JSON.stringify(i.sideChoices) : null,
        i.selectedSide || null,
        i.hasIncludedSide ? 1 : 0,
        i.tags ? JSON.stringify(i.tags) : JSON.stringify([]),
        i.packagingFee || null,
        i.date || settings.menuDate || null
      ));
    })();
    const newVersion = incrementMenuVersion();
    const updated = getMenu(db);
    broadcast({ type: "MENU_UPDATE", menu: updated, version: newVersion, menuDate: settings.menuDate });
    res.json({ success: true, menu: updated, menuVersion: newVersion, menuDate: settings.menuDate });
  } catch (err: any) {
    next(err);
  }
};

export const fetchMenuBackups = (req: Request, res: Response, next: NextFunction) => {
  try {
    // ⚡ Bolt Optimization: Offload JSON parsing to SQLite
    // Instead of bringing large JSON payloads into Node.js and parsing them sequentially
    // just to count the array length, we use SQLite's native JSON1 extension functions.
    // This reduces Node's CPU overhead and garbage collection pressure, especially with
    // many large backup payloads.
    const backups = db.prepare(`
      SELECT
        id,
        timestamp,
        menuDate,
        menuVersion,
        length(menuData) as rawSize,
        CASE
          WHEN json_valid(menuData) AND json_type(menuData) = 'array' THEN json_array_length(menuData)
          ELSE 0
        END as itemCount
      FROM menu_backups
      ORDER BY timestamp DESC
    `).all() as any[];

    res.json(backups.map(b => ({
      id: b.id,
      timestamp: b.timestamp,
      menuDate: b.menuDate,
      menuVersion: b.menuVersion,
      itemCount: b.itemCount
    })));
  } catch (err) {
    next(err);
  }
};

export const restoreMenuBackup = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const backup = db.prepare("SELECT * FROM menu_backups WHERE id = ?").get(Number(id)) as any;
    if (!backup) {
      return res.status(404).json({ error: "Backup not found" });
    }

    const items = JSON.parse(backup.menuData);
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "Invalid backup menu data" });
    }

    db.transaction(() => {
      // Create a rollback backup of the current menu first
      const currentMenu = getMenu(db);
      if (currentMenu && currentMenu.length > 0) {
        db.prepare("INSERT INTO menu_backups (timestamp, menuDate, menuData, menuVersion) VALUES (?, ?, ?, ?)")
          .run(new Date().toISOString(), settings.menuDate || "", JSON.stringify(currentMenu), settings.menuVersion);
        
        // Prune backups: Keep only the latest 10 backups
        db.prepare(`
          DELETE FROM menu_backups 
          WHERE id NOT IN (
            SELECT id FROM menu_backups 
            ORDER BY timestamp DESC 
            LIMIT 10
          )
        `).run();
      }

      // Restore menuDate
      settings.menuDate = backup.menuDate || "";
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .run("menu_date", settings.menuDate);

      // Restore menu items
      db.prepare("DELETE FROM menu").run();
      const insert = db.prepare(`
        INSERT INTO menu (
          id, name, description, price, available, category, 
          requiresSideChoice, sideChoices, selectedSide, hasIncludedSide,
          tags, packagingFee, date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      items.forEach((i: any) => insert.run(
        i.id, 
        i.name, 
        i.description, 
        i.price, 
        i.available ? 1 : 0, 
        i.category,
        i.requiresSideChoice ? 1 : 0,
        i.sideChoices ? JSON.stringify(i.sideChoices) : null,
        i.selectedSide || null,
        i.hasIncludedSide ? 1 : 0,
        i.tags ? JSON.stringify(i.tags) : JSON.stringify([]),
        i.packagingFee || null,
        i.date || settings.menuDate || null
      ));
    })();

    const newVersion = incrementMenuVersion();
    const updated = getMenu(db);
    broadcast({ type: "MENU_UPDATE", menu: updated, version: newVersion, menuDate: settings.menuDate });
    res.json({ success: true, menu: updated, menuVersion: newVersion, menuDate: settings.menuDate });
  } catch (err: any) {
    next(err);
  }
};
