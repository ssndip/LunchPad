import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { getMenu, getMenuItemById } from "./menuController";
import { broadcast } from "../broadcast";
import { kioskOpen } from "./statusController";
import { settings } from "../config";

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
    const { rfid, pin, items: requestedItems, menuVersion: requestedVersion } = req.body as { rfid?: string, pin?: string, items: RequestedItem[], menuVersion?: number };

    const isBypass = settings.testModeEnabled && !rfid && !pin;

    if (!isBypass && (!rfid && !pin) || !requestedItems || !Array.isArray(requestedItems) || requestedItems.length === 0) {
      return res.status(400).json({ error: "Invalid request: Missing RFID/PIN or items" });
    }
    
    // Concurrency Check: Menu version must match
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
      // PIN Lookup (must be exactly 6 digits)
      if (pin.length !== 6) return res.status(400).json({ error: "PIN must be 6 digits" });
      card = db.prepare("SELECT * FROM cards WHERE pin = ?").get(pin) as any;
      if (!card) {
        console.warn(`[Order] Failed PIN login attempt: ${pin}`);
        return res.status(401).json({ error: "Incorrect or unknown PIN" });
      }
    } else if (rfid) {
      const cleanRfid = rfid.trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
      card = db.prepare("SELECT * FROM cards WHERE LOWER(rfid) = ?").get(cleanRfid) as any;
      
      const isTestAdmin = cleanRfid === 'test-admin';
      if (!card && !isTestAdmin) {
        return res.status(404).json({ error: `Card not found: ${cleanRfid}` });
      }
    } else if (settings.testModeEnabled) {
      // Test Mode Bypass: Use TEST-ADMIN as fallback
      card = db.prepare("SELECT * FROM cards WHERE rfid = ?").get("TEST-ADMIN") as any;
      if (!card) {
        // Fallback if TEST-ADMIN was somehow deleted or not seeded
        card = { rfid: "test-bypass", ownerName: "Test Mode User", balance: 0 };
      }
    } else {
      // No identification provided at all
      return res.status(401).json({ error: "No RFID or PIN provided" });
    }

    // Strict Validation & Enrichment
    const enrichedItems: any[] = [];

    for (const ri of requestedItems) {
      const baseItem = getMenuItemById(db, ri.id);
      if (!baseItem) continue;

      // Feature 7: Strict Side-Dish Validation
      if (baseItem.requiresSideChoice || baseItem.hasIncludedSide) {
        if (!ri.side) {
          return res.status(400).json({ 
            error: "Side Dish Required", 
            message: `Please select a side dish for ${baseItem.name}.` 
          });
        }
        
        // If there are specific constrained choices, validate against them
        if (baseItem.sideChoices && baseItem.sideChoices.length > 0) {
          const isValid = baseItem.sideChoices.includes(ri.side);
          if (!isValid) {
            return res.status(400).json({ 
              error: "Invalid Side Dish", 
              message: `The selected side "${ri.side}" is not allowed for ${baseItem.name}.` 
            });
          }
        }
      }

      enrichedItems.push({ ...baseItem, side: ri.side });
    }

    if (enrichedItems.length === 0) return res.status(400).json({ error: "No valid items selected" });

    const total = enrichedItems.reduce((sum: number, i) => {
      const basePrice = Number(i.price) || 0;
      // Mirror the frontend logic: Tag-aware packaging fee
      const tags = i.tags || [];
      const isAutobox = tags.some((t: string) => t === 'autobox' || t === 'has_custom_box' || t === 'bbq');
      const category = (i.category || '').toLowerCase();
      const isCategorizedBox = category.includes('side dishes') || category.includes('гарнитури') || category.includes('bbq') || category.includes('скара');
      
      const itemFee = (i.packagingFee !== undefined && i.packagingFee !== null) 
        ? i.packagingFee 
        : ((isAutobox || isCategorizedBox) ? (settings.packagingFee || 0.1) : 0);

      const itemTotal = basePrice + itemFee;
      return sum + itemTotal;
    }, 0);

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const orderId = `ORD-${Date.now()}`;

    const newOrder = {
      id: orderId,
      rfid: card.rfid, 
      ownerName: card.ownerName,
      items: enrichedItems,
      totalPrice: Number(total.toFixed(2)),
      timestamp: now.toISOString(),
      date: dateStr,
      status: "completed"
    };

    db.transaction(() => {
      db.prepare("UPDATE cards SET balance = balance + ?, lastUpdated = ? WHERE rfid = ?")
        .run(total, now.toISOString(), card.rfid);
      
      db.prepare("INSERT INTO orders (id, rfid, ownerName, items, totalPrice, timestamp, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(orderId, card.rfid, card.ownerName, JSON.stringify(enrichedItems), total, now.toISOString(), dateStr, "completed");

      const summary = db.prepare("SELECT * FROM daily_summaries WHERE date = ?").get(dateStr) as any;
      if (!summary) {
        db.prepare("INSERT INTO daily_summaries (date, totalSales, orderCount) VALUES (?, ?, ?)")
          .run(dateStr, total, 1);
      } else {
        db.prepare("UPDATE daily_summaries SET totalSales = totalSales + ?, orderCount = orderCount + 1 WHERE date = ?")
          .run(total, dateStr);
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
    const orders = db.prepare("SELECT items FROM orders WHERE date = ?").all(date) as any[];
    
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
          
          const sideName = item.side ? item.side.trim() : "";
          const displayName = sideName ? `${item.name} (${sideName})` : item.name;
          const aggregationKey = `${item.name}|${sideName}`;

          if (!itemMap[aggregationKey]) {
            itemMap[aggregationKey] = { 
              name: displayName, 
              quantity: 0, 
              total: 0, 
              price: Number(item.price) || 0, 
              category: item.category || 'Uncategorized' 
            };
          }
          itemMap[aggregationKey].quantity += 1;
          itemMap[aggregationKey].total += (Number(item.price) || 0);
        });
      }
    });
    
    res.json({
      items: Object.values(itemMap).sort((a, b) => a.name.localeCompare(b.name)),
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

    const orders = db.prepare(sql).all(...params) as any[];
    
    // 1. Aggregates
    const mealCounts: Record<string, number> = {};
    const sideCounts: Record<string, number> = {};
    const hourlyDistribution: Record<number, number> = {};
    const customerSpending: Record<string, { rfid: string, name: string, total: number, count: number }> = {};
    const dailyData: Record<string, { date: string, revenue: number, orders: number }> = {};

    let totalRevenue = 0;

    orders.forEach(o => {
      let items = [];
      try {
        items = o.items ? JSON.parse(o.items) : [];
      } catch {}

      const orderTotal = Number(o.totalPrice) || 0;
      totalRevenue += orderTotal;

      // Items Stats
      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          mealCounts[item.name] = (mealCounts[item.name] || 0) + 1;
          if (item.side) {
            sideCounts[item.side] = (sideCounts[item.side] || 0) + 1;
          }
        });
      }

      // Hourly distribution
      const hour = new Date(o.timestamp).getHours();
      hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;

      // Customer spending
      const cRfid = o.rfid || 'unknown';
      if (!customerSpending[cRfid]) {
        customerSpending[cRfid] = { rfid: cRfid, name: o.ownerName || 'Unknown', total: 0, count: 0 };
      }
      customerSpending[cRfid].total += orderTotal;
      customerSpending[cRfid].count += 1;

      // Daily distribution (for timeline chart)
      const d = o.date;
      if (!dailyData[d]) {
        dailyData[d] = { date: d, revenue: 0, orders: 0 };
      }
      dailyData[d].revenue += orderTotal;
      dailyData[d].orders += 1;
    });

    const popularMeals = Object.entries(mealCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const popularSides = Object.entries(sideCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const peakTimes = Object.entries(hourlyDistribution)
      .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

    const topCustomers = Object.values(customerSpending)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const timeline = Object.values(dailyData)
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({ 
      popularMeals, 
      popularSides, 
      peakTimes,
      topCustomers,
      timeline,
      summary: {
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalOrders: orders.length,
        avgOrderValue: orders.length > 0 ? Number((totalRevenue / orders.length).toFixed(2)) : 0,
        uniqueCustomers: Object.keys(customerSpending).length
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
