import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { broadcast } from "../broadcast";
import { hashPin, cleanRfid as cleanRfidUtil } from "../config";

export const getCards = () => {
  const cards = db.prepare("SELECT * FROM cards").all() as any[];
  return cards.map(c => ({ ...c, isAdmin: c.isAdmin === 1 }));
};

export const fetchCards = (req: Request, res: Response) => {
  res.json(getCards());
};

export const addOrUpdateCard = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rfid, ownerName, balance, isAdmin, pin } = req.body;
    if (!rfid || !ownerName) {
      return res.status(400).json({ error: "RFID and ownerName are required" });
    }
    if (typeof rfid !== 'string' || rfid.length > 50) {
      return res.status(400).json({ error: "Invalid RFID length" });
    }
    if (typeof ownerName !== 'string' || ownerName.length > 100) {
      return res.status(400).json({ error: "Invalid ownerName length" });
    }
    if (pin !== undefined && pin !== null && typeof pin !== 'string') {
      return res.status(400).json({ error: "Invalid PIN format" });
    }
    const now = new Date().toISOString();
    const cleanRfid = cleanRfidUtil(rfid);

    // PIN Uniqueness Check
    let hashedPin = pin || null;
    if (pin) {
      hashedPin = hashPin(pin);
      const existing = db.prepare("SELECT rfid FROM cards WHERE pin = ? AND LOWER(rfid) != ?").get(hashedPin, cleanRfid) as any;
      if (existing) {
        return res.status(409).json({ error: "PIN is already assigned to another card." });
      }
    }

    db.prepare(`
      INSERT INTO cards (rfid, ownerName, balance, lastUpdated, isAdmin, pin)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(rfid) DO UPDATE SET
        ownerName = excluded.ownerName,
        balance = excluded.balance,
        lastUpdated = excluded.lastUpdated,
        isAdmin = excluded.isAdmin,
        pin = excluded.pin
    `).run(cleanRfid, ownerName, balance || 0, now, isAdmin ? 1 : 0, hashedPin);
    
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
      if (c.pin !== undefined && c.pin !== null && typeof c.pin !== 'string') {
         return res.status(400).json({ error: "Invalid PIN format in batch" });
      }
    }
    const now = new Date().toISOString();
    db.transaction(() => {
      const insert = db.prepare(`
        INSERT OR IGNORE INTO cards (rfid, ownerName, balance, lastUpdated, isAdmin, pin)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      cards.forEach((c: any) => {
        const cleanRfid = cleanRfidUtil(c.rfid);
        const hashedPin = c.pin ? hashPin(c.pin) : null;
        insert.run(cleanRfid, c.ownerName, c.balance || 0, now, c.isAdmin ? 1 : 0, hashedPin);
      });
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
    const cleanRfid = cleanRfidUtil(rfid);
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
      const insert = db.prepare("INSERT INTO cards (rfid, ownerName, balance, lastUpdated, isAdmin, pin) VALUES (?, ?, ?, ?, ?, ?)");
      const now = new Date().toISOString();
      cards.forEach((c: any) => {
        const cleanRfid = cleanRfidUtil(c.rfid);
        const hashedPin = c.pin ? hashPin(c.pin) : null;
        insert.run(cleanRfid, c.ownerName, c.balance || 0, now, c.isAdmin ? 1 : 0, hashedPin);
      });
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
    const cleanRfid = cleanRfidUtil(rfid);
    db.prepare("UPDATE cards SET balance = 0, lastUpdated = ? WHERE LOWER(rfid) = ?").run(new Date().toISOString(), cleanRfid);
    broadcast({ type: "CARDS_UPDATE" });
    res.json({ success: true, cards: getCards() });
  } catch (err: any) {
    next(err);
  }
};

export const updateSingleCard = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rfid } = req.params;
    const { ownerName, balance, isAdmin, pin } = req.body;
    const cleanRfid = cleanRfidUtil(rfid);

    // PIN Uniqueness Check (if PIN is provided and changing)
    let hashedPin = pin || null;
    if (pin) {
      hashedPin = hashPin(pin);
      const existing = db.prepare("SELECT rfid FROM cards WHERE pin = ? AND LOWER(rfid) != ?").get(hashedPin, cleanRfid) as any;
      if (existing) {
        return res.status(409).json({ error: "PIN is already assigned to another card." });
      }
    }

    db.prepare(`
      UPDATE cards 
      SET ownerName = ?, balance = ?, isAdmin = ?, pin = ?, lastUpdated = ?
      WHERE LOWER(rfid) = ?
    `).run(ownerName, balance || 0, isAdmin ? 1 : 0, hashedPin, new Date().toISOString(), cleanRfid);

    broadcast({ type: "CARDS_UPDATE" });
    res.json({ success: true, card: getCards().find(c => c.rfid.toLowerCase() === cleanRfid) });
  } catch (err: any) {
    next(err);
  }
};

export const getCardProfile = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rfid } = req.params;
    const cleanRfid = cleanRfidUtil(rfid);
    
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
