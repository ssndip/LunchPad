import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { broadcast } from "../broadcast";
import { kioskOpen } from "./statusController";
import { settings } from "../config";
import * as OrderService from "../services/orderService";

export const getOrders = (limit = 50) => {
  try {
    const orders = db.prepare("SELECT * FROM orders ORDER BY timestamp DESC LIMIT ?").all(limit) as any[];
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

interface RequestedItem {
  id: number;
  side?: string;
}

export const placeOrder = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rfid, pin, items: requestedItems, menuVersion: requestedVersion } = req.body as { rfid?: string, pin?: string, items: OrderService.RequestedItem[], menuVersion?: number };

    const isBypass = settings.testModeEnabled && !rfid && !pin;

    if (!isBypass && (!rfid && !pin) || !requestedItems || !Array.isArray(requestedItems) || requestedItems.length === 0) {
      return res.status(400).json({ error: "Invalid request: Missing RFID/PIN or items" });
    }
    
    if (requestedVersion !== undefined && requestedVersion !== settings.menuVersion) {
      return res.status(409).json({ 
        error: "Menu Updated", 
        message: "The menu has been updated. Please review your cart.",
        currentVersion: settings.menuVersion 
      });
    }
    
    if (!kioskOpen) return res.status(403).json({ error: "Kiosk is closed." });

    let card: any;

    if (pin) {
      if (pin.length !== 6) return res.status(400).json({ error: "PIN must be 6 digits" });
      card = db.prepare("SELECT * FROM cards WHERE pin = ?").get(pin) as any;
      if (!card) return res.status(401).json({ error: "Incorrect or unknown PIN" });
    } else if (rfid) {
      const cleanRfid = rfid.trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
      card = db.prepare("SELECT * FROM cards WHERE LOWER(rfid) = ?").get(cleanRfid) as any;
      
      if (!card && cleanRfid === 'test-admin' && settings.enableTestBypass) {
        card = db.prepare("SELECT * FROM cards WHERE rfid = ?").get("TEST-ADMIN") as any;
      }

      if (!card) return res.status(404).json({ error: `Card not found: ${cleanRfid}` });
    } else if (settings.testModeEnabled && settings.enableTestBypass) {
      card = db.prepare("SELECT * FROM cards WHERE rfid = ?").get("TEST-ADMIN") as any;
      if (!card) card = { rfid: "test-bypass", ownerName: "Test Mode User", balance: 0 };
    } else {
      return res.status(401).json({ error: "No RFID or PIN provided" });
    }

    // Use OrderService for validation, enrichment, and processing
    let enrichedItems;
    try {
      enrichedItems = OrderService.validateAndEnrichItems(requestedItems);
    } catch (err: any) {
      return res.status(400).json({ error: "Validation Error", message: err.message });
    }

    const newOrder = OrderService.processOrderTransaction(card, enrichedItems);

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
      db.prepare("DELETE FROM orders").run();
      db.prepare("DELETE FROM daily_summaries").run();
    })();
    broadcast({ 
      type: "INITIAL_STATE", 
      menu: getMenu(db), 
      orders: [], 
      kioskOpen, 
      cards: [],
      deliveryFee: settings.deliveryFee,
      packagingFee: settings.packagingFee,
      menuVersion: settings.menuVersion,
      adminWhitelistEnabled: settings.adminWhitelistEnabled,
      orderButtonEnabled: settings.orderButtonEnabled,
      testModeEnabled: settings.testModeEnabled,
      kioskModeEnabled: settings.kioskModeEnabled,
      allowPWAInstall: settings.allowPWAInstall,
      systemLanguage: settings.systemLanguage,
      menuDate: settings.menuDate
    });
    res.json({ success: true });
  } catch (err: any) {
    next(err);
  }
};

export const fetchSummaries = (req: Request, res: Response) => {
  const summaries = db.prepare(`
    SELECT 
      ds.*,
      (SELECT COUNT(DISTINCT rfid) FROM orders WHERE orders.date = ds.date) as uniqueUserCount
    FROM daily_summaries ds
    ORDER BY date DESC LIMIT 30
  `).all();
  res.json(summaries);
};

export const fetchSummaryDetails = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date } = req.params;
    
    const items = db.prepare(`
      SELECT 
        CASE 
          WHEN json_extract(value, '$.side') IS NOT NULL AND json_extract(value, '$.side') != '' 
          THEN json_extract(value, '$.name') || ' (' || json_extract(value, '$.side') || ')'
          ELSE json_extract(value, '$.name')
        END as name,
        COUNT(*) as quantity,
        SUM(json_extract(value, '$.price')) as total,
        json_extract(value, '$.price') as price,
        json_extract(value, '$.category') as category
      FROM orders, json_each(items)
      WHERE date = ?
      GROUP BY name
      ORDER BY name ASC
    `).all(date);
    
    res.json({
      items,
      sides: []
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
  if (rfid) { 
    sql += " AND (rfid = ? OR ownerName LIKE ? ESCAPE '\\')"; 
    params.push(rfid);
    const escapedSearch = (rfid as string).replace(/[\\%_]/g, '\\$&');
    params.push(`%${escapedSearch}%`);
  }
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

export const fetchAnalytics = (req: Request, res: Response) => {
  try {
    const { startDate, endDate, rfid, ownerName } = req.query;
    let whereClause = " WHERE 1=1";
    const params: any[] = [];

    if (startDate) { whereClause += " AND date >= ?"; params.push(startDate); }
    if (endDate) { whereClause += " AND date <= ?"; params.push(endDate); }
    if (rfid) { whereClause += " AND rfid = ?"; params.push(rfid); }
    if (ownerName) {
      whereClause += " AND ownerName LIKE ? ESCAPE '\\'";
      const escapedOwnerName = (ownerName as string).replace(/[\\%_]/g, '\\$&');
      params.push(`%${escapedOwnerName}%`);
    }

    // 1. Popular Meals
    const popularMeals = db.prepare(`
      SELECT json_extract(value, '$.name') as name, COUNT(*) as count
      FROM orders, json_each(items)
      ${whereClause}
      GROUP BY name
      ORDER BY count DESC
      LIMIT 10
    `).all(...params);

    // 2. Popular Sides
    const popularSides = db.prepare(`
      SELECT json_extract(value, '$.side') as name, COUNT(*) as count
      FROM orders, json_each(items)
      ${whereClause} AND json_extract(value, '$.side') IS NOT NULL AND json_extract(value, '$.side') != ''
      GROUP BY name
      ORDER BY count DESC
      LIMIT 10
    `).all(...params);

    // 3. Peak Times
    const peakTimes = db.prepare(`
      SELECT strftime('%H:00', timestamp) as hour, COUNT(*) as count
      FROM orders
      ${whereClause}
      GROUP BY hour
      ORDER BY hour ASC
    `).all(...params);

    // 4. Top Customers
    const topCustomers = db.prepare(`
      SELECT rfid, ownerName as name, SUM(totalPrice) as total, COUNT(*) as count
      FROM orders
      ${whereClause}
      GROUP BY rfid
      ORDER BY total DESC
      LIMIT 10
    `).all(...params);

    // 5. Timeline
    const timeline = db.prepare(`
      SELECT date, SUM(totalPrice) as revenue, COUNT(*) as orders
      FROM orders
      ${whereClause}
      GROUP BY date
      ORDER BY date ASC
    `).all(...params);

    // 6. Overall Summary
    const summary = db.prepare(`
      SELECT 
        SUM(totalPrice) as totalRevenue,
        COUNT(*) as totalOrders,
        AVG(totalPrice) as avgOrderValue,
        COUNT(DISTINCT rfid) as uniqueCustomers
      FROM orders
      ${whereClause}
    `).get(...params) as any;

    res.json({ 
      popularMeals, 
      popularSides, 
      peakTimes,
      topCustomers,
      timeline,
      summary: {
        totalRevenue: Number((summary.totalRevenue || 0).toFixed(2)),
        totalOrders: summary.totalOrders || 0,
        avgOrderValue: Number((summary.avgOrderValue || 0).toFixed(2)),
        uniqueCustomers: summary.uniqueCustomers || 0
      }
    });
  } catch (err: any) {
    console.error("[Analytics] Error:", err);
    res.status(500).json({ error: "Failed to fetch analytics", message: err.message });
  }
};
export const applyDeliveryFee = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, fee } = req.body as { date: string, fee: number };
    
    if (!date || fee === undefined || fee <= 0) {
      return res.status(400).json({ error: "Invalid date or fee amount" });
    }

    // 1. Check if fee has already been distributed for this date
    const summary = db.prepare("SELECT feeDistributed FROM daily_summaries WHERE date = ?").get(date) as { feeDistributed: number } | undefined;
    
    if (summary && summary.feeDistributed) {
      return res.status(409).json({ error: "Fee already distributed for this date" });
    }

    // 2. Find all unique RFIDs that ordered on that target date
    const rows = db.prepare("SELECT DISTINCT rfid FROM orders WHERE date = ?").all(date) as { rfid: string }[];
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "No orders found for this date" });
    }

    const uniqueUsersCount = rows.length;
    const splitFee = Number((fee / uniqueUsersCount).toFixed(2));

    const now = new Date().toISOString();

    // 3. Perform updates in a transaction
    db.transaction(() => {
      const updateStmt = db.prepare("UPDATE cards SET balance = balance + ?, lastUpdated = ? WHERE rfid = ?");
      for (const row of rows) {
        updateStmt.run(splitFee, now, row.rfid);
      }
      
      // Mark as distributed in summary
      db.prepare("UPDATE daily_summaries SET feeDistributed = 1, distributedAmount = ? WHERE date = ?")
        .run(fee, date);
    })();

    console.log(`[Fee] Distributed ${fee}€ to ${uniqueUsersCount} users (${splitFee}€ each) for ${date}`);

    res.json({
      success: true,
      userCount: uniqueUsersCount,
      splitFee: splitFee
    });

  } catch (err: any) {
    next(err);
  }
};
