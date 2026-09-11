import crypto from "crypto";
import { db } from "../db";
import { settings } from "../config";
import { getMenuItemById } from "../controllers/menuController";
import { broadcast } from "../broadcast";
import { localDateString } from "../utils/localTime";

export interface RequestedItem {
  id: number;
  side?: string;
}

export interface EnrichedItem {
  id: number;
  name: string;
  price: number;
  category?: string;
  tags?: string[];
  packagingFee?: number;
  side?: string;
  [key: string]: any;
}

export const calculateItemPrice = (item: any) => {
  const basePrice = Number(item.price) || 0;
  
  // Tag-aware packaging fee logic
  const tags = item.tags || [];
  const isAutobox = tags.some((t: string) => t === 'autobox' || t === 'has_custom_box' || t === 'bbq');
  const category = (item.category || '').toLowerCase();
  
  // Check for Bulgarian and English category names
  const isCategorizedBox = category.includes('side dishes') || 
                           category.includes('гарнитури') || 
                           category.includes('bbq') || 
                           category.includes('скара');
  
  const itemFee = (item.packagingFee !== undefined && item.packagingFee !== null) 
    ? item.packagingFee 
    : ((isAutobox || isCategorizedBox) ? (settings.packagingFee || 0.1) : 0);

  return {
    basePrice,
    itemFee,
    total: basePrice + itemFee
  };
};

export const validateAndEnrichItems = (requestedItems: RequestedItem[]) => {
  const enrichedItems: EnrichedItem[] = [];

  // Anything the customer asked for that we will not serve. Collected rather
  // than thrown on sight so a full cart is reported in one go, and de-duplicated
  // because the kiosk expands quantity into repeated entries.
  const unorderable = new Set<string>();

  for (const ri of requestedItems) {
    const baseItem = getMenuItemById(db, ri.id);

    // An unknown id used to be skipped with `continue`, which let an order for
    // three items where two had been removed succeed while charging for one.
    if (!baseItem) {
      unorderable.add(`#${ri.id}`);
      continue;
    }

    // `available` is the manager's Active/Inactive toggle, which the kiosk
    // honours by hiding the tile (KioskItemList) — but the server accepted the
    // id regardless, so a cart already holding an item as it was deactivated
    // still went through.
    if (!baseItem.available) {
      unorderable.add(baseItem.name);
      continue;
    }

    // Side-Dish Validation
    if (baseItem.requiresSideChoice || baseItem.hasIncludedSide) {
      if (!ri.side) {
        throw new Error(`Side dish required for ${baseItem.name}`);
      }
      
      if (baseItem.sideChoices && baseItem.sideChoices.length > 0) {
        if (!baseItem.sideChoices.includes(ri.side)) {
          throw new Error(`Invalid side dish "${ri.side}" for ${baseItem.name}`);
        }
      }
    }

    enrichedItems.push({ ...baseItem, side: ri.side });
  }

  // Refuse the whole order rather than silently serving the remainder — a
  // partial order the customer was never told about is worse than a failed one.
  if (unorderable.size > 0) {
    throw new Error(`No longer available: ${[...unorderable].join(', ')}`);
  }

  if (enrichedItems.length === 0) {
    throw new Error("No valid items selected");
  }

  return enrichedItems;
};

/**
 * Look up an order already recorded under this client attempt id.
 *
 * Returns the stored order in the same shape a fresh one has, so a replay can
 * be answered with the original rather than creating a second charge.
 */
export const findOrderByClientId = (clientOrderId: string) => {
  const row = db.prepare("SELECT * FROM orders WHERE clientOrderId = ?").get(clientOrderId) as any;
  if (!row) return null;

  let items = [];
  try {
    items = row.items ? JSON.parse(row.items) : [];
  } catch (e) {
    console.error(`[DB Error] Failed to parse items for order ${row.id}`, e);
  }
  return { ...row, items: Array.isArray(items) ? items : [] };
};

export const processOrderTransaction = (card: any, enrichedItems: EnrichedItem[], clientOrderId?: string) => {
  const total = enrichedItems.reduce((sum, item) => sum + calculateItemPrice(item).total, 0);
  const roundedTotal = Number(total.toFixed(2));
  
  const now = new Date();
  // The canteen's date, not UTC's — the kiosk's opening hours are judged on the
  // same clock, and the daily summary has to roll over at the same moment.
  const dateStr = localDateString(now);
  // Four random digits collide roughly once in 9000 orders sharing a
  // millisecond, and a collision is a primary-key violation — a 500 at the till.
  const orderId = `ORD-${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;

  const orderData = {
    id: orderId,
    rfid: card.rfid,
    ownerName: card.ownerName,
    items: enrichedItems,
    totalPrice: roundedTotal,
    timestamp: now.toISOString(),
    date: dateStr,
    status: "completed",
    clientOrderId: clientOrderId ?? null
  };

  db.transaction(() => {
    // 1. Update Card Balance
    db.prepare("UPDATE cards SET balance = balance + ?, lastUpdated = ? WHERE rfid = ?")
      .run(roundedTotal, now.toISOString(), card.rfid);
    
    // 2. Insert Order. The unique index on clientOrderId means a concurrent
    //    replay fails here rather than charging twice; the caller turns that
    //    into the original order.
    db.prepare("INSERT INTO orders (id, rfid, ownerName, items, totalPrice, timestamp, date, status, clientOrderId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(orderId, card.rfid, card.ownerName, JSON.stringify(enrichedItems), roundedTotal, now.toISOString(), dateStr, "completed", clientOrderId ?? null);

    // 3. Update Daily Summary
    const summary = db.prepare("SELECT * FROM daily_summaries WHERE date = ?").get(dateStr) as any;
    if (!summary) {
      db.prepare("INSERT INTO daily_summaries (date, totalSales, orderCount) VALUES (?, ?, ?)")
        .run(dateStr, roundedTotal, 1);
    } else {
      db.prepare("UPDATE daily_summaries SET totalSales = totalSales + ?, orderCount = orderCount + 1 WHERE date = ?")
        .run(roundedTotal, dateStr);
    }
  })();

  return orderData;
};
