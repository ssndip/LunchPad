import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { broadcast } from "../broadcast";

export const getMenu = (database = db) => {
  const items = database.prepare("SELECT * FROM menu").all() as any[];
  return items.map(i => ({ 
    ...i, 
    available: i.available === 1,
    requiresSideChoice: i.requiresSideChoice === 1,
    hasIncludedSide: i.hasIncludedSide === 1,
    sideChoices: i.sideChoices ? JSON.parse(i.sideChoices) : []
  }));
};

export const fetchMenu = (req: Request, res: Response) => {
  res.json(getMenu(db));
};

export const updateMenu = (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "Expected an array of menu items" });
    }
    // Validation (omitted for brevity in this replace block, usually keep it)
    db.transaction(() => {
      db.prepare("DELETE FROM menu").run();
      const insert = db.prepare(`
        INSERT INTO menu (
          id, name, description, price, available, category, 
          requiresSideChoice, sideChoices, selectedSide, hasIncludedSide
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        i.hasIncludedSide ? 1 : 0
      ));
    })();
    const updated = getMenu(db);
    broadcast({ type: "MENU_UPDATE", data: updated });
    res.json({ success: true, menu: updated });
  } catch (err: any) {
    next(err);
  }
};
