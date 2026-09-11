import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { broadcast } from "../broadcast";
import { hashPin, cleanRfid as cleanRfidUtil } from "../config";

/**
 * Reject a payload that would leave two cards sharing a PIN.
 *
 * Checkout looks a PIN up by equality, so a duplicate charges an arbitrary one
 * of the matching cards. `addOrUpdateCard` and `updateSingleCard` have always
 * checked this; the batch import and the bulk update did not, which is how
 * duplicates got in. Returns an error message, or undefined when the payload is
 * fine.
 *
 * @param replacesAllCards when true the payload is the entire new card table,
 *        so only collisions within it matter.
 */
const findPinConflict = (
  entries: { rfid: string; hashedPin: string | null }[],
  replacesAllCards: boolean,
): string | undefined => {
  const seen = new Map<string, string>();

  for (const { rfid, hashedPin } of entries) {
    if (!hashedPin) continue; // No PIN set: nothing to collide with.

    const clash = seen.get(hashedPin);
    if (clash) {
      return `Duplicate PIN in submitted data: "${clash}" and "${rfid}" share a PIN.`;
    }
    seen.set(hashedPin, rfid);

    if (!replacesAllCards) {
      const existing = db.prepare("SELECT rfid FROM cards WHERE pin = ? AND LOWER(rfid) != ?")
        .get(hashedPin, rfid) as any;
      if (existing) {
        return `PIN for "${rfid}" is already assigned to another card ("${existing.rfid}").`;
      }
    }
  }

  return undefined;
};

/** Hash a submitted PIN unless it already arrived as a digest. */
const toStoredPin = (pin: any): string | null => {
  if (!pin) return null;
  const isAlreadyHashed = pin.length === 64 && /^[0-9a-fA-F]{64}$/.test(pin);
  return isAlreadyHashed ? pin : hashPin(pin);
};

/**
 * Cards as the dashboard sees them.
 *
 * The PIN digest is deliberately not selected. It is an unsalted HMAC over a
 * six-digit number, so anything holding it is one cheap brute force away from
 * the PIN itself — and this list goes to the dashboard, the WebSocket bootstrap
 * and the CSV export. `hasPin` is all the UI actually needs.
 */
export const getCards = () => {
  const cards = db.prepare(
    "SELECT rfid, ownerName, balance, lastUpdated, isAdmin, (pin IS NOT NULL) AS hasPin FROM cards"
  ).all() as any[];
  return cards.map(c => ({ ...c, isAdmin: c.isAdmin === 1, hasPin: c.hasPin === 1 }));
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
    if (pin !== undefined && pin !== null) {
      if (typeof pin !== 'string') return res.status(400).json({ error: "Invalid PIN format" });
      const isAlreadyHashed = pin.length === 64 && /^[0-9a-fA-F]{64}$/.test(pin);
      if (!isAlreadyHashed) {
        if (pin.length !== 6) return res.status(400).json({ error: "PIN must be exactly 6 digits" });
        if (!/^\d{6}$/.test(pin)) return res.status(400).json({ error: "PIN must contain only digits" });
      }
    }
    const numBalance = balance !== undefined && balance !== null ? Number(balance) : 0;
    if (isNaN(numBalance)) {
      return res.status(400).json({ error: "Balance must be a valid number" });
    }
    const now = new Date().toISOString();
    const cleanRfid = cleanRfidUtil(rfid);

    // RFID Conflict Check
    const existingRfid = db.prepare("SELECT 1 FROM cards WHERE LOWER(rfid) = ?").get(cleanRfid);
    if (existingRfid) {
      return res.status(409).json({ error: "Card with this RFID already exists." });
    }

    // PIN Uniqueness Check
    let hashedPin = pin || null;
    if (pin) {
      const isAlreadyHashed = pin.length === 64 && /^[0-9a-fA-F]{64}$/.test(pin);
      if (!isAlreadyHashed) {
        hashedPin = hashPin(pin);
      }
      const existing = db.prepare("SELECT rfid FROM cards WHERE pin = ? AND LOWER(rfid) != ?").get(hashedPin, cleanRfid) as any;
      if (existing) {
        return res.status(409).json({ error: "PIN is already assigned to another card." });
      }
    }

    db.prepare(`
      INSERT INTO cards (rfid, ownerName, balance, lastUpdated, isAdmin, pin)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(cleanRfid, ownerName, numBalance, now, isAdmin ? 1 : 0, hashedPin);
    
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
      if (c.pin !== undefined && c.pin !== null) {
         if (typeof c.pin !== 'string') return res.status(400).json({ error: "Invalid PIN format in batch" });
         const isAlreadyHashed = c.pin.length === 64 && /^[0-9a-fA-F]{64}$/.test(c.pin);
         if (!isAlreadyHashed) {
           if (c.pin.length !== 6) return res.status(400).json({ error: "PIN must be exactly 6 digits in batch" });
           if (!/^\d{6}$/.test(c.pin)) return res.status(400).json({ error: "PIN must contain only digits in batch" });
         }
      }
    }
    const prepared = cards.map((c: any) => ({
      ...c,
      rfid: cleanRfidUtil(c.rfid),
      hashedPin: toStoredPin(c.pin),
    }));

    const conflict = findPinConflict(prepared, false);
    if (conflict) return res.status(409).json({ error: conflict });

    const now = new Date().toISOString();
    db.transaction(() => {
      const insert = db.prepare(`
        INSERT OR IGNORE INTO cards (rfid, ownerName, balance, lastUpdated, isAdmin, pin)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      prepared.forEach((c: any) => {
        insert.run(c.rfid, c.ownerName, c.balance || 0, now, c.isAdmin ? 1 : 0, c.hashedPin);
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
    // A card that matched nothing used to report success, so a mistyped or
    // already-deleted RFID looked to the dashboard exactly like a card that had
    // just been removed.
    const { changes } = db.prepare("DELETE FROM cards WHERE LOWER(rfid) = ?").run(cleanRfid);
    if (changes === 0) {
      return res.status(404).json({ error: "Card not found" });
    }
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
      if (c.pin !== undefined && c.pin !== null) {
         if (typeof c.pin !== 'string') return res.status(400).json({ error: "Invalid PIN format in update" });
         const isAlreadyHashed = c.pin.length === 64 && /^[0-9a-fA-F]{64}$/.test(c.pin);
         if (!isAlreadyHashed) {
           if (c.pin.length !== 6) return res.status(400).json({ error: "PIN must be exactly 6 digits in update" });
           if (!/^\d{6}$/.test(c.pin)) return res.status(400).json({ error: "PIN must contain only digits in update" });
         }
      }
    }
    const prepared = cards.map((c: any) => ({
      ...c,
      rfid: cleanRfidUtil(c.rfid),
      hashedPin: toStoredPin(c.pin),
    }));

    const conflict = findPinConflict(prepared, true);
    if (conflict) return res.status(409).json({ error: conflict });

    db.transaction(() => {
      db.prepare("DELETE FROM cards").run();
      const insert = db.prepare("INSERT INTO cards (rfid, ownerName, balance, lastUpdated, isAdmin, pin) VALUES (?, ?, ?, ?, ?, ?)");
      const now = new Date().toISOString();
      prepared.forEach((c: any) => {
        insert.run(c.rfid, c.ownerName, c.balance || 0, now, c.isAdmin ? 1 : 0, c.hashedPin);
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
    // As with deleteCard: no matching card is a 404, not a silent success.
    const { changes } = db.prepare("UPDATE cards SET balance = 0, lastUpdated = ? WHERE LOWER(rfid) = ?")
      .run(new Date().toISOString(), cleanRfid);
    if (changes === 0) {
      return res.status(404).json({ error: "Card not found" });
    }
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

    if (!ownerName || typeof ownerName !== 'string' || ownerName.length > 100) {
      return res.status(400).json({ error: "Invalid or missing ownerName" });
    }

    const numBalance = balance !== undefined && balance !== null ? Number(balance) : 0;
    if (isNaN(numBalance)) {
      return res.status(400).json({ error: "Balance must be a valid number" });
    }

    const existing = db.prepare("SELECT rfid FROM cards WHERE LOWER(rfid) = ?").get(cleanRfid) as any;
    if (!existing) {
      return res.status(404).json({ error: "Card not found" });
    }

    // The PIN is three-state:
    //   absent      -> leave whatever is stored alone
    //   null or ""  -> clear it
    //   a value     -> validate and set it
    // It used to be written unconditionally from `pin || null`, which preserved
    // PINs only because the client echoed the stored hash back. Now that the
    // hash never leaves the server, that would have wiped a PIN on every edit.
    const pinProvided = Object.prototype.hasOwnProperty.call(req.body, 'pin');
    let hashedPin: string | null = null;

    if (pinProvided && pin !== null && pin !== '') {
      if (typeof pin !== 'string') return res.status(400).json({ error: "Invalid PIN format" });
      const isAlreadyHashed = pin.length === 64 && /^[0-9a-fA-F]{64}$/.test(pin);
      if (isAlreadyHashed) {
        hashedPin = pin;
      } else {
        if (pin.length !== 6) return res.status(400).json({ error: "PIN must be exactly 6 digits" });
        if (!/^\d{6}$/.test(pin)) return res.status(400).json({ error: "PIN must contain only digits" });
        hashedPin = hashPin(pin);
      }
      const clash = db.prepare("SELECT rfid FROM cards WHERE pin = ? AND LOWER(rfid) != ?").get(hashedPin, cleanRfid) as any;
      if (clash) {
        return res.status(409).json({ error: "PIN is already assigned to another card." });
      }
    }

    const now = new Date().toISOString();
    if (pinProvided) {
      db.prepare(`
        UPDATE cards 
        SET ownerName = ?, balance = ?, isAdmin = ?, pin = ?, lastUpdated = ?
        WHERE LOWER(rfid) = ?
      `).run(ownerName, numBalance, isAdmin ? 1 : 0, hashedPin, now, cleanRfid);
    } else {
      db.prepare(`
        UPDATE cards 
        SET ownerName = ?, balance = ?, isAdmin = ?, lastUpdated = ?
        WHERE LOWER(rfid) = ?
      `).run(ownerName, numBalance, isAdmin ? 1 : 0, now, cleanRfid);
    }

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

/**
 * RFIDs the kiosk may vouch for while it is offline.
 *
 * Admin cards are deliberately excluded. `/api/auth/login` accepts an admin
 * card's RFID as the entire credential, so publishing that RFID here handed
 * every client on the canteen LAN — which is all this endpoint requires — a
 * dashboard password: read the list, replay each entry at the login endpoint,
 * and whichever one belongs to an admin card returns an admin token.
 *
 * The cost is that an admin's own card cannot be validated at the kiosk while
 * the network is down (KioskView's isCachedRfid). Once back online the order
 * goes through normally, and a credential is not something to scatter across
 * every tablet's localStorage to buy that.
 */
export const fetchActiveRfidList = (req: Request, res: Response, next: NextFunction) => {
  try {
    const cards = db.prepare("SELECT rfid FROM cards WHERE isAdmin != 1 OR isAdmin IS NULL").all() as { rfid: string }[];
    res.json(cards.map(c => c.rfid.toLowerCase()));
  } catch (err) {
    next(err);
  }
};
