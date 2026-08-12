import { db } from "../db";
import { settings } from "../config";
import { getMenuItemById } from "../controllers/menuController";
import { broadcast } from "../broadcast";

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
  const itemCache = new Map<number, any>(); // ⚡ Bolt: Cache to prevent N+1 queries for identical items

  for (const ri of requestedItems) {
    let baseItem = itemCache.get(ri.id);
    if (!baseItem) {
      baseItem = getMenuItemById(db, ri.id);
      if (baseItem) {
        itemCache.set(ri.id, baseItem);
      }
    }

    if (!baseItem) continue;

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

  if (enrichedItems.length === 0) {
    throw new Error("No valid items selected");
  }

  return enrichedItems;
};

export const processOrderTransaction = (card: any, enrichedItems: EnrichedItem[]) => {
  const total = enrichedItems.reduce((sum, item) => sum + calculateItemPrice(item).total, 0);
  const roundedTotal = Number(total.toFixed(2));
  
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const orderData = {
    id: orderId,
    rfid: card.rfid,
    ownerName: card.ownerName,
    items: enrichedItems,
    totalPrice: roundedTotal,
    timestamp: now.toISOString(),
    date: dateStr,
    status: "completed"
  };

  db.transaction(() => {
    // 1. Update Card Balance
    db.prepare("UPDATE cards SET balance = balance + ?, lastUpdated = ? WHERE rfid = ?")
      .run(roundedTotal, now.toISOString(), card.rfid);
    
    // 2. Insert Order
    db.prepare("INSERT INTO orders (id, rfid, ownerName, items, totalPrice, timestamp, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(orderId, card.rfid, card.ownerName, JSON.stringify(enrichedItems), roundedTotal, now.toISOString(), dateStr, "completed");

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
