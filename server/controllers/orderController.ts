import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { getMenu } from "./menuController";
import { broadcast } from "../broadcast";
import { kioskOpen } from "./statusController";

const stmts = {
  getOrders: db.prepare("SELECT * FROM orders ORDER BY timestamp DESC LIMIT ?"),
  findCardByRfid: db.prepare("SELECT * FROM cards WHERE LOWER(rfid) = ?"),
  updateCardBalance: db.prepare("UPDATE cards SET balance = balance + ?, lastUpdated = ? WHERE rfid = ?"),
  insertOrder: db.prepare("INSERT INTO orders (id, rfid, ownerName, items, totalPrice, timestamp, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
  getDailySummary: db.prepare("SELECT * FROM daily_summaries WHERE date = ?"),
  insertDailySummary: db.prepare("INSERT INTO daily_summaries (date, totalSales, orderCount) VALUES (?, ?, ?)"),
  updateDailySummary: db.prepare("UPDATE daily_summaries SET totalSales = totalSales + ?, orderCount = orderCount + 1 WHERE date = ?"),
  deleteOrders: db.prepare("DELETE FROM orders"),
  deleteSummaries: db.prepare("DELETE FROM daily_summaries"),
  fetchSummaries: db.prepare("SELECT * FROM daily_summaries ORDER BY date DESC LIMIT 30"),
  fetchSummaryDetails: db.prepare("SELECT items FROM orders WHERE date = ?")
};

export const getOrders = (limit = 50) => {
  try {
    const orders = stmts.getOrders.all(limit) as any[];
    return orders.map(o => {
      let items = [];
      try {
        items = o.items ? JSON.parse(o.items) : [];
      } catch (e) {
        console.error(`[DB Error] Failed to parse items for order ${o.id}`, e);
      }
      return { ...o, items: Array.isArray(items) ? items : [] };
    });
  } catch (err) {
    console.error("[DB Error] getOrders failed", err);
    return [];
  }
};

export const fetchOrders = (req: Request, res: Response) => {
  res.json(getOrders());
};

export const placeOrder = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rfid, items: requestedItems } = req.body;
    if (!rfid || !requestedItems || !Array.isArray(requestedItems)) {
      return res.status(400).json({ error: "Invalid request: Missing RFID or items" });
    }
    if (!kioskOpen) return res.status(403).json({ error: "Kiosk is closed." });

    const cleanRfid = rfid.trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
    const card = stmts.findCardByRfid.get(cleanRfid) as any;
    if (!card) return res.status(404).json({ error: `Card not found: ${cleanRfid}` });

    const menu = getMenu(db);
    const menuMap = new Map(menu.map(m => [m.id, m]));
    
    const enrichedItems = requestedItems.map((ri: any) => {
      const baseItem = menuMap.get(ri.id);
      if (!baseItem) return null;
      return { ...baseItem, side: ri.side };
    }).filter(Boolean);

    if (enrichedItems.length === 0) return res.status(400).json({ error: "No valid items selected" });

    const total = enrichedItems.reduce((sum: number, i: any) => sum + i.price, 0);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const orderId = `ORD-${Date.now()}`;

    const newOrder = {
      id: orderId,
      rfid: card.rfid, 
      ownerName: card.ownerName,
      items: enrichedItems,
      totalPrice: total,
      timestamp: now.toISOString(),
      date: dateStr,
      status: "completed"
    };

    db.transaction(() => {
      stmts.updateCardBalance.run(total, now.toISOString(), card.rfid);
      
      stmts.insertOrder.run(orderId, card.rfid, card.ownerName, JSON.stringify(enrichedItems), total, now.toISOString(), dateStr, "completed");

      const summary = stmts.getDailySummary.get(dateStr) as any;
      if (!summary) {
        stmts.insertDailySummary.run(dateStr, total, 1);
      } else {
        stmts.updateDailySummary.run(total, dateStr);
      }
    })();

    const { rfid: _rfid, ...sanitizedOrder } = newOrder;
    broadcast({ type: "NEW_ORDER", data: sanitizedOrder });
    res.json({ success: true, order: newOrder });

  } catch (err: any) {
    next(err);
  }
};

export const resetOrders = (req: Request, res: Response, next: NextFunction) => {
  try {
    db.transaction(() => {
      stmts.deleteOrders.run();
      stmts.deleteSummaries.run();
    })();
    broadcast({ type: "INITIAL_STATE", menu: getMenu(db), orders: [], kioskOpen, cards: [] });
    res.json({ success: true });
  } catch (err: any) {
    next(err);
  }
};

export const fetchSummaries = (req: Request, res: Response) => {
  const summaries = stmts.fetchSummaries.all();
  res.json(summaries);
};

export const fetchSummaryDetails = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date } = req.params;
    const orders = stmts.fetchSummaryDetails.all(date) as any[];
    
    const itemMap: Record<string, { name: string, quantity: number, total: number, price: number, category: string }> = {};
    const sideMap: Record<string, { name: string, quantity: number }> = {};
    
    orders.forEach(order => {
      let items = [];
      try {
        items = order.items ? JSON.parse(order.items) : [];
      } catch (e) {
        console.error("[DB Error] Failed to parse summary items", e);
      }

      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          if (!item || !item.name) return;
          
          // Main Item Aggregation
          if (!itemMap[item.name]) {
            itemMap[item.name] = { 
              name: item.name, 
              quantity: 0, 
              total: 0, 
              price: Number(item.price) || 0, 
              category: item.category || 'Uncategorized' 
            };
          }
          itemMap[item.name].quantity += 1;
          itemMap[item.name].total += (Number(item.price) || 0);

          // Side Dish Aggregation
          if (item.side) {
            if (!sideMap[item.side]) {
              sideMap[item.side] = { name: item.side, quantity: 0 };
            }
            sideMap[item.side].quantity += 1;
          }
        });
      }
    });
    
    res.json({
      items: Object.values(itemMap).sort((a, b) => b.total - a.total),
      sides: Object.values(sideMap).sort((a, b) => b.quantity - a.quantity)
    });
  } catch (err: any) {
    next(err);
  }
};

export const fetchHistory = (req: Request, res: Response, next: NextFunction) => {
  const { startDate, endDate, rfid, ownerName } = req.query;
  let sql = "SELECT * FROM orders WHERE 1=1";
  const params: any[] = [];

  if (startDate) { sql += " AND date >= ?"; params.push(startDate); }
  if (endDate) { sql += " AND date <= ?"; params.push(endDate); }
  if (rfid) { sql += " AND rfid = ?"; params.push(rfid); }
  if (ownerName) {
    sql += " AND ownerName LIKE ? ESCAPE '\\'";
    const escapedOwnerName = (ownerName as string).replace(/[\\%_]/g, '\\$&');
    params.push(`%${escapedOwnerName}%`);
  }

  sql += " ORDER BY timestamp DESC LIMIT 100";
  try {
    const orders = db.prepare(sql).all(...params) as any[];
    res.json(orders.map(o => {
      let items = [];
      try {
        items = o.items ? JSON.parse(o.items) : [];
      } catch (e) {
        console.error(`[DB Error] History parse error for ${o.id}`, e);
      }
      return { ...o, items: Array.isArray(items) ? items : [] };
    }));
  } catch (err: any) {
    err.message = "Failed to query history: " + err.message;
    next(err);
  }
};
