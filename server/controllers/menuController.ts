import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { broadcast } from "../broadcast";
import { incrementMenuVersion, settings } from "../config";

export const getMenu = (database = db) => {
  const items = database.prepare("SELECT * FROM menu").all() as any[];
  return items.map(i => ({ 
    ...i, 
    available: i.available === 1,
    requiresSideChoice: i.requiresSideChoice === 1,
    hasIncludedSide: i.hasIncludedSide === 1,
    sideChoices: i.sideChoices ? JSON.parse(i.sideChoices) : [],
    tags: i.tags ? JSON.parse(i.tags) : [],
    packagingFee: i.packagingFee,
    menuVersion: settings.menuVersion,
    menuDate: settings.menuDate
  }));
};

let getMenuItemStmt: any = null;

export const getMenuItemById = (database = db, id: number) => {
  if (!getMenuItemStmt) {
    getMenuItemStmt = database.prepare("SELECT * FROM menu WHERE id = ?");
  }
  const i = getMenuItemStmt.get(id) as any;
  if (!i) return null;

  return {
    ...i,
    available: i.available === 1,
    requiresSideChoice: i.requiresSideChoice === 1,
    hasIncludedSide: i.hasIncludedSide === 1,
    sideChoices: i.sideChoices ? JSON.parse(i.sideChoices) : [],
    tags: i.tags ? JSON.parse(i.tags) : [],
    packagingFee: i.packagingFee,
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

    db.transaction(() => {
      // Save menuDate if provided
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
          tags, packagingFee
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        i.packagingFee || null
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
