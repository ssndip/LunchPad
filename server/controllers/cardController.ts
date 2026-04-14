import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { broadcast } from "../broadcast";

export const getCards = () => {
  const cards = db.prepare("SELECT * FROM cards").all() as any[];
  return cards.map(c => ({ ...c, isAdmin: c.isAdmin === 1 }));
};

export const fetchCards = (req: Request, res: Response) => {
  res.json(getCards());
};

export const addOrUpdateCard = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rfid, ownerName, balance, isAdmin } = req.body;
    if (!rfid || !ownerName) {
      return res.status(400).json({ error: "RFID and ownerName are required" });
    }
    if (typeof rfid !== 'string' || rfid.length > 50) {
      return res.status(400).json({ error: "Invalid RFID length" });
    }
    if (typeof ownerName !== 'string' || ownerName.length > 100) {
      return res.status(400).json({ error: "Invalid ownerName length" });
    }
    const now = new Date().toISOString();
    const cleanRfid = rfid.trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
    db.prepare(`
      INSERT INTO cards (rfid, ownerName, balance, lastUpdated, isAdmin)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(rfid) DO UPDATE SET
        ownerName = excluded.ownerName,
        balance = excluded.balance,
        lastUpdated = excluded.lastUpdated,
        isAdmin = excluded.isAdmin
    `).run(cleanRfid, ownerName, balance || 0, now, isAdmin ? 1 : 0);
    
    broadcast({ type: "CARDS_UPDATE" });
    res.json({ success: true, cards: getCards() });
  } catch (err: any) {
    next(err);
  }
};

export const batchAddCards = (req: Request, res: Response, next: NextFunction) => {
  try {
    const cards = req.body;
    if (!Array.isArray(cards)) {
      return res.status(400).json({ error: "Expected an array of cards" });
    }
    for (const c of cards) {
      if (!c.rfid || typeof c.rfid !== 'string' || c.rfid.length > 50) {
         return res.status(400).json({ error: "Invalid RFID length in batch" });
      }
      if (!c.ownerName || typeof c.ownerName !== 'string' || c.ownerName.length > 100) {
         return res.status(400).json({ error: "Invalid ownerName length in batch" });
      }
    }
    const now = new Date().toISOString();
    db.transaction(() => {
      const insert = db.prepare(`
        INSERT OR IGNORE INTO cards (rfid, ownerName, balance, lastUpdated, isAdmin)
        VALUES (?, ?, ?, ?, ?)
      `);
      cards.forEach((c: any) => insert.run(c.rfid.trim(), c.ownerName, c.balance || 0, now, c.isAdmin ? 1 : 0));
    })();
    broadcast({ type: "CARDS_UPDATE" });
    res.json({ success: true, cards: getCards() });
  } catch (err: any) {
    next(err);
  }
};

export const deleteCard = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rfid } = req.params;
    const cleanRfid = rfid.trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
    db.prepare("DELETE FROM cards WHERE LOWER(rfid) = ?").run(cleanRfid);
    broadcast({ type: "CARDS_UPDATE" });
    res.json({ success: true, cards: getCards() });
  } catch (err: any) {
    next(err);
  }
};

export const updateAllCards = (req: Request, res: Response, next: NextFunction) => {
  try {
    const cards = req.body;
    if (!Array.isArray(cards)) {
      return res.status(400).json({ error: "Expected an array of cards" });
    }
    for (const c of cards) {
      if (!c.rfid || typeof c.rfid !== 'string' || c.rfid.length > 50) {
         return res.status(400).json({ error: "Invalid RFID length in update" });
      }
      if (!c.ownerName || typeof c.ownerName !== 'string' || c.ownerName.length > 100) {
         return res.status(400).json({ error: "Invalid ownerName length in update" });
      }
    }
    db.transaction(() => {
      db.prepare("DELETE FROM cards").run();
      const insert = db.prepare("INSERT INTO cards (rfid, ownerName, balance, lastUpdated, isAdmin) VALUES (?, ?, ?, ?, ?)");
      const now = new Date().toISOString();
      cards.forEach((c: any) => insert.run(c.rfid.trim(), c.ownerName, c.balance || 0, now, c.isAdmin ? 1 : 0));
    })();
    broadcast({ type: "CARDS_UPDATE" });
    res.json({ success: true, cards: getCards() });
  } catch (err: any) {
    next(err);
  }
};

export const resetAllBalances = (req: Request, res: Response, next: NextFunction) => {
  try {
    db.prepare("UPDATE cards SET balance = 0, lastUpdated = ?").run(new Date().toISOString());
    broadcast({ type: "CARDS_UPDATE" });
    res.json({ success: true, cards: getCards() });
  } catch (err: any) {
    next(err);
  }
};

export const resetSingleBalance = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rfid } = req.params;
    const cleanRfid = rfid.trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
    db.prepare("UPDATE cards SET balance = 0, lastUpdated = ? WHERE LOWER(rfid) = ?").run(new Date().toISOString(), cleanRfid);
    broadcast({ type: "CARDS_UPDATE" });
    res.json({ success: true, cards: getCards() });
  } catch (err: any) {
    next(err);
  }
};

export const getCardProfile = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rfid } = req.params;
    const cleanRfid = rfid.trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
    
    const card = db.prepare("SELECT * FROM cards WHERE LOWER(rfid) = ?").get(cleanRfid) as any;
    if (!card) return res.status(404).json({ error: "Card not found" });

    const orders = db.prepare("SELECT * FROM orders WHERE LOWER(rfid) = ? ORDER BY timestamp DESC LIMIT 5").all(cleanRfid) as any[];
    const parsedOrders = orders.map(o => ({
      ...o,
      items: o.items ? JSON.parse(o.items) : []
    }));

    res.json({
      rfid: card.rfid,
      ownerName: card.ownerName,
      balance: card.balance,
      isAdmin: card.isAdmin === 1,
      orders: parsedOrders
    });
  } catch (err: any) {
    next(err);
  }
};
