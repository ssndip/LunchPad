import 'dotenv/config';
import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import net from "net";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import Database from "better-sqlite3";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Database Setup ---
const DB_DIR = process.env.NODE_ENV === 'production' ? '/app/data' : '.';
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : path.join(DB_DIR, 'lunchpad.db');
console.log(`[DB] Initializing database at: ${dbPath}`);
export const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    rfid TEXT PRIMARY KEY,
    ownerName TEXT NOT NULL,
    balance REAL DEFAULT 0,
    lastUpdated TEXT,
    isAdmin INTEGER DEFAULT 0
  );
`);

// Migration for existing databases
try {
  db.exec("ALTER TABLE cards ADD COLUMN isAdmin INTEGER DEFAULT 0");
  console.log("[DB] Added isAdmin column to cards table");
} catch (e) {
  // Column already exists
}

db.exec(`
  CREATE TABLE IF NOT EXISTS menu (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price REAL,
    available INTEGER,
    category TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    rfid TEXT,
    ownerName TEXT,
    items TEXT, -- JSON string
    totalPrice REAL,
    timestamp TEXT,
    date TEXT,
    status TEXT
  );

  CREATE TABLE IF NOT EXISTS daily_summaries (
    date TEXT PRIMARY KEY,
    totalSales REAL DEFAULT 0,
    orderCount INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  -- ⚡ Bolt: Indexes for O(1) descending sorts
  CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(date DESC);

  -- ⚡ Bolt: Index for O(1) lookup of lowercased RFIDs
  CREATE INDEX IF NOT EXISTS idx_cards_lower_rfid ON cards(LOWER(rfid));
`);

// --- Settings Cache ---
let globalAccessConfig = false;
let orderButtonEnabledConfig = true;
let testModeConfig = false;
let adminPinConfig = process.env.ADMIN_PIN || "0000";

const initSettings = () => {
  const globalAccess = db.prepare("SELECT value FROM settings WHERE key = ?").get("global_access") as { value: string } | undefined;
  if (!globalAccess) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("global_access", "0");
    globalAccessConfig = false;
  } else {
    globalAccessConfig = globalAccess.value === "1";
  }

  const orderButton = db.prepare("SELECT value FROM settings WHERE key = ?").get("order_button_enabled") as { value: string } | undefined;
  if (!orderButton) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("order_button_enabled", "1");
    orderButtonEnabledConfig = true;
  } else {
    orderButtonEnabledConfig = orderButton.value === "1";
  }

  const testMode = db.prepare("SELECT value FROM settings WHERE key = ?").get("test_mode_enabled") as { value: string } | undefined;
  if (!testMode) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("test_mode_enabled", "0");
    testModeConfig = false;
  } else {
    testModeConfig = testMode.value === "1";
  }

  const adminPin = db.prepare("SELECT value FROM settings WHERE key = ?").get("admin_pin") as { value: string } | undefined;
  if (!adminPin) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("admin_pin", adminPinConfig);
  } else {
    adminPinConfig = adminPin.value;
  }
};

const initTestAdmin = () => {
  const existing = db.prepare("SELECT * FROM cards WHERE rfid = ?").get("TEST-ADMIN");
  if (!existing) {
    db.prepare("INSERT INTO cards (rfid, ownerName, balance, isAdmin, lastUpdated) VALUES (?, ?, ?, ?, ?)")
      .run("TEST-ADMIN", "Test Administrator", 999.00, 1, new Date().toISOString());
    console.log("[DB] Seeded TEST-ADMIN card for RFID-less ordering");
  }
};

initSettings();

const isLocalOrigin = (origin?: string): boolean => {
  if (!origin || origin === 'null') return true; // Standard browser same-origin/internal requests
  try {
    const u = new URL(origin);
    const hostname = u.hostname;
    // Localhost / Loopback
    if (hostname === 'localhost' || hostname === '[::1]') return true;
    
    if (net.isIPv4(hostname)) {
      if (hostname === '127.0.0.1' || hostname === '0.0.0.0') return true;
      // Private IP Ranges
      // 192.168.x.x
      if (hostname.startsWith('192.168.')) return true;
      // 10.x.x.x
      if (hostname.startsWith('10.')) return true;
      // 172.16.x.x to 172.31.x.x
      if (hostname.startsWith('172.')) {
        const parts = hostname.split('.');
        if (parts.length >= 2) {
          const secondOctet = parseInt(parts[1], 10);
          if (secondOctet >= 16 && secondOctet <= 31) return true;
        }
      }
    }
    // Docker / Internal service names (e.g., 'lunchpad')
    if (!hostname.includes('.')) return true;
  } catch (e) {
    return false; // Don't allow by default on error to prevent bypasses
  }
  return false;
};
let cachedMenu: any[] | null = null;

export const getMenu = (database: Database.Database = db) => {
  const items = database.prepare("SELECT * FROM menu").all() as any[];
  return items.map(i => ({ ...i, available: i.available === 1 }));
};

export const invalidateMenuCache = () => {
  // No longer caching menu
};

// --- Initial Data ---
const seedMenu = () => {
  const count = db.prepare("SELECT COUNT(*) as count FROM menu").get() as { count: number };
  if (count.count === 0) {
    const initialMenu = [
      { id: 1, name: "Пилешка супа", description: "Традиционна пилешка супа", price: 1.80, available: 1, category: "Супи" },
      { id: 2, name: "Шкембе", description: "Класическо шкембе чорба", price: 1.80, available: 1, category: "Супи" },
      { id: 3, name: "Таратор", description: "Свеж таратор с кисело мляко", price: 1.50, available: 1, category: "Супи" },
      { id: 4, name: "Кюфтета по чирпански", description: "Кюфтета със сос и картофи", price: 2.90, available: 1, category: "Основни ястия" },
      { id: 5, name: "Пилешка кавърма", description: "Пилешко месо със зеленчуци", price: 3.20, available: 1, category: "Основни ястия" },
    ];
    const insert = db.prepare("INSERT INTO menu (id, name, description, price, available, category) VALUES (?, ?, ?, ?, ?, ?)");
    initialMenu.forEach(item => insert.run(item.id, item.name, item.description, item.price, item.available, item.category));
    console.log("[DB] Seeded initial menu");
  }
};

const seedCards = () => {
  const count = db.prepare("SELECT COUNT(*) as count FROM cards").get() as { count: number };
  if (count.count === 0) {
    const initialCards = [
      { rfid: "1234567890", ownerName: "Test User", balance: 0 },
      { rfid: "0987654321", ownerName: "Admin User", balance: 0 }
    ];
    const insert = db.prepare("INSERT INTO cards (rfid, ownerName, balance, lastUpdated) VALUES (?, ?, ?, ?)");
    initialCards.forEach(card => insert.run(card.rfid, card.ownerName, card.balance, new Date().toISOString()));
    console.log("[DB] Seeded initial cards");
  }
};

seedMenu();
seedCards();
initTestAdmin();

// --- Server Setup ---
export const appPromise = startServer();

export async function startServer() {
  const app = express();
  app.set("trust proxy", true); // Handle reverse proxy headers
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  const PORT = process.env.PORT || 3400;

  app.use(cors({
    origin: (origin, callback) => {
      // If Global Access is enabled, allow ALL origins
      if (globalAccessConfig) {
        return callback(null, true);
      }

      // If Global Access is DISABLED, allow ONLY local origins
      if (isLocalOrigin(origin)) {
        return callback(null, true);
      }

      console.warn(`[CORS] REJECTED: origin="${origin}". (Set 'Global Network Access' to ENABLED in Settings if this is intended)`);
      callback(new Error('Access Denied: Global Access is disabled.'), false);
    }
  }));
  app.use(express.json({ limit: '500kb' }));

  let kioskOpen = true;

  // --- Helpers ---
  const broadcast = (data: any) => {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  const getCards = () => {
    const cards = db.prepare("SELECT * FROM cards").all() as any[];
    return cards.map(c => ({ ...c, isAdmin: c.isAdmin === 1 }));
  };

  const getOrders = (limit = 50) => {
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

  // --- API Routes ---

  if (!process.env.ADMIN_PIN) {
    console.warn(`⚠️ WARNING: ADMIN_PIN environment variable is not set. Using default logic (DB or 0000)`);
  }

  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const pin = req.headers['x-admin-pin'];
    if (!pin) {
      return res.status(401).json({ error: "Unauthorized: Missing PIN or Card" });
    }

    if (pin === adminPinConfig) {
      return next();
    }

    // Check if the provided pin is a valid RFID of an admin card
    const cleanRfid = String(pin).trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
    const adminCard = db.prepare("SELECT * FROM cards WHERE LOWER(rfid) = ? AND isAdmin = 1").get(cleanRfid);
    
    if (adminCard) {
      return next();
    }

    return res.status(401).json({ error: "Unauthorized: Invalid PIN or Admin Card" });
  };


  // Health check
  app.get("/ping", (req, res) => res.send("pong"));

  // Kiosk Status
  app.get("/api/status", (req, res) => res.json({ kioskOpen }));
  app.post("/api/status", requireAuth, (req, res) => {
    kioskOpen = !!req.body.open;
    broadcast({ type: "STATUS_UPDATE", data: { kioskOpen } });
    res.json({ success: true, kioskOpen });
  });

  // Settings
  app.get("/api/settings", requireAuth, (req, res) => {
    res.json({ 
      globalAccess: globalAccessConfig,
      orderButtonEnabled: orderButtonEnabledConfig,
      testModeEnabled: testModeConfig
    });
  });

  app.post("/api/settings", requireAuth, (req, res, next) => {
    try {
      const { globalAccess, orderButtonEnabled, testModeEnabled } = req.body;
      
      if (globalAccess !== undefined) {
        if (typeof globalAccess !== 'boolean') return res.status(400).json({ error: "Invalid value for globalAccess" });
        db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("global_access", globalAccess ? "1" : "0");
        globalAccessConfig = globalAccess;
        console.log(`[Settings] Global Access is now ${globalAccess ? 'ENABLED' : 'DISABLED'} (InMemory updated)`);
      }

      if (orderButtonEnabled !== undefined) {
        if (typeof orderButtonEnabled !== 'boolean') return res.status(400).json({ error: "Invalid value for orderButtonEnabled" });
        db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("order_button_enabled", orderButtonEnabled ? "1" : "0");
        orderButtonEnabledConfig = orderButtonEnabled;
        broadcast({ type: "STATUS_UPDATE", data: { kioskOpen, orderButtonEnabled: orderButtonEnabledConfig, testModeEnabled: testModeConfig } });
        console.log(`[Settings] Order Button is now ${orderButtonEnabled ? 'ENABLED' : 'DISABLED'} (InMemory updated)`);
      }

      if (testModeEnabled !== undefined) {
        if (typeof testModeEnabled !== 'boolean') return res.status(400).json({ error: "Invalid value for testModeEnabled" });
        db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("test_mode_enabled", testModeEnabled ? "1" : "0");
        testModeConfig = testModeEnabled;
        broadcast({ type: "STATUS_UPDATE", data: { kioskOpen, orderButtonEnabled: orderButtonEnabledConfig, testModeEnabled: testModeConfig } });
        console.log(`[Settings] Test mode is now ${testModeEnabled ? 'ENABLED' : 'DISABLED'} (InMemory updated)`);
      }

      res.json({ 
        success: true, 
        globalAccess: globalAccessConfig, 
        orderButtonEnabled: orderButtonEnabledConfig, 
        testModeEnabled: testModeConfig
      });
    } catch (err: any) {
      next(err);
    }
  });

  app.post("/api/settings/pin", requireAuth, (req, res, next) => {
    try {
      const { newPin } = req.body;
      if (!newPin || typeof newPin !== 'string') {
        return res.status(400).json({ error: "Invalid PIN" });
      }
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("admin_pin", newPin);
      adminPinConfig = newPin;
      console.log(`[Settings] Admin PIN has been updated (InMemory updated)`);
      res.json({ success: true });
    } catch (err: any) {
      next(err);
    }
  });

  app.get("/api/init", (req, res) => {
    res.json({
      menu: getMenu(),
      kioskOpen,
      globalAccess: globalAccessConfig,
      orderButtonEnabled: orderButtonEnabledConfig,
      testModeEnabled: testModeConfig
    });
  });

  // Menu Management
  app.get("/api/menu", (req, res) => res.json(getMenu(db)));
  app.post("/api/menu", requireAuth, (req, res, next) => {
    try {
      const items = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "Expected an array of menu items" });
      }
      for (const i of items) {
        if (i.name && (typeof i.name !== 'string' || i.name.length > 200)) {
           return res.status(400).json({ error: "Invalid menu item name length" });
        }
        if (i.description && (typeof i.description !== 'string' || i.description.length > 1000)) {
           return res.status(400).json({ error: "Invalid menu item description length" });
        }
        if (i.category && (typeof i.category !== 'string' || i.category.length > 100)) {
           return res.status(400).json({ error: "Invalid menu item category length" });
        }
      }
      db.transaction(() => {
        db.prepare("DELETE FROM menu").run();
        const insert = db.prepare("INSERT INTO menu (id, name, description, price, available, category) VALUES (?, ?, ?, ?, ?, ?)");
        items.forEach((i: any) => insert.run(i.id, i.name, i.description, i.price, i.available ? 1 : 0, i.category));
      })();
      invalidateMenuCache();
      const updated = getMenu(db);
      broadcast({ type: "MENU_UPDATE", data: updated });
      res.json({ success: true, menu: updated });
    } catch (err: any) {
      next(err);
    }
  });

  // Card Management
  app.get("/api/cards", requireAuth, (req, res) => res.json(getCards()));

  // Add/Update single card
  app.post("/api/cards", requireAuth, (req, res, next) => {
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
      
      const updated = getCards();
      broadcast({ type: "CARDS_UPDATE" });
      res.json({ success: true, cards: updated });
    } catch (err: any) {
      console.error("[Card Add Error]", err);
      next(err);
    }
  });
  // Batch add cards
  app.post("/api/cards/batch", requireAuth, (req, res, next) => {
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
      const updated = getCards();
      broadcast({ type: "CARDS_UPDATE" });
      res.json({ success: true, cards: updated });
    } catch (err: any) {
      console.error("[Card Batch Error]", err);
      next(err);
    }
  });
  // Delete card
  app.delete("/api/cards/:rfid", requireAuth, (req, res, next) => {
    try {
      const { rfid } = req.params;
      const cleanRfid = rfid.trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
      db.prepare("DELETE FROM cards WHERE LOWER(rfid) = ?").run(cleanRfid);
      const updated = getCards();
      broadcast({ type: "CARDS_UPDATE" });
      res.json({ success: true, cards: updated });
    } catch (err: any) {
      console.error("[Card Delete Error]", err);
      next(err);
    }
  });

  // Update all cards (bulk update/replace)
  app.post("/api/cards/update", requireAuth, (req, res, next) => {
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
      const updated = getCards();
      broadcast({ type: "CARDS_UPDATE" });
      res.json({ success: true, cards: updated });
    } catch (err: any) {
      console.error("[Card Update Error]", err);
      next(err);
    }
  });

  // Reset all balances (monthly clear)
  app.post("/api/cards/reset-all", requireAuth, (req, res, next) => {
    try {
      db.prepare("UPDATE cards SET balance = 0, lastUpdated = ?").run(new Date().toISOString());
      const updated = getCards();
      broadcast({ type: "CARDS_UPDATE" });
      res.json({ success: true, cards: updated });
    } catch (err: any) {
      console.error("[Card Reset All Error]", err);
      next(err);
    }
  });

  // Reset single card balance
  app.post("/api/cards/:rfid/reset", requireAuth, (req, res, next) => {
    try {
      const { rfid } = req.params;
      const cleanRfid = rfid.trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
      db.prepare("UPDATE cards SET balance = 0, lastUpdated = ? WHERE LOWER(rfid) = ?").run(new Date().toISOString(), cleanRfid);
      const updated = getCards();
      broadcast({ type: "CARDS_UPDATE" });
      res.json({ success: true, cards: updated });
    } catch (err: any) {
      console.error("[Card Reset Single Error]", err);
      next(err);
    }
  });
  
  // Feature 3: Scan-to-Load Profile (Balance + History)
  app.get("/api/cards/:rfid/profile", (req, res, next) => {
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
        recentOrders: parsedOrders
      });
    } catch (err: any) {
      console.error("[Profile Fetch Error]", err);
      next(err);
    }
  });

  // Order Processing
  app.post("/api/v1/order", (req, res, next) => {
    try {
      const { rfid, itemIds } = req.body;
      if (!rfid || !itemIds || !Array.isArray(itemIds)) {
        return res.status(400).json({ error: "Invalid request: Missing RFID or items" });
      }
      if (!kioskOpen) return res.status(403).json({ error: "Kiosk is closed. Please open it from the Admin panel." });

      // Match frontend cleaning logic: trim, remove non-printable, lowercase
      const cleanRfid = rfid.trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
      console.log(`[Order] Processing RFID: "${cleanRfid}" (original: "${rfid}")`);
      
      // Robust lookup
      const card = db.prepare("SELECT * FROM cards WHERE LOWER(rfid) = ?").get(cleanRfid) as any;
      if (!card) return res.status(404).json({ error: `Card not found: ${cleanRfid}. Please register it in the Admin panel.` });

      const menu = getMenu(db);
      const itemIdSet = new Set(itemIds);
      const selectedItems = menu.filter(m => itemIdSet.has(m.id));
      if (selectedItems.length === 0) return res.status(400).json({ error: "No valid items selected" });

      const total = selectedItems.reduce((sum, i) => sum + i.price, 0);
      const now = new Date();
      
      // Sequential date logic (all orders for Today)
      let dateStr = now.toISOString().split('T')[0];
      const orderId = `ORD-${Date.now()}`;

      const newOrder = {
        id: orderId,
        rfid: card.rfid, // Use the one from DB for consistency
        ownerName: card.ownerName,
        items: selectedItems,
        totalPrice: total,
        timestamp: now.toISOString(),
        date: dateStr,
        status: "completed"
      };

      db.transaction(() => {
        // Update balance (accumulate owed amount)
        db.prepare("UPDATE cards SET balance = balance + ?, lastUpdated = ? WHERE rfid = ?")
          .run(total, now.toISOString(), card.rfid);
        
        // Save order
        db.prepare("INSERT INTO orders (id, rfid, ownerName, items, totalPrice, timestamp, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .run(orderId, card.rfid, card.ownerName, JSON.stringify(selectedItems), total, now.toISOString(), dateStr, "completed");

        // Update summary
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
      console.log(`[Order] SUCCESS: ${orderId} for "${card.rfid}" - Total: €${total.toFixed(2)}`);
      res.json({ success: true, order: newOrder });

    } catch (err: any) {
      console.error("[Order Processing Error]", err);
      next(err);
    }
  });

  // History & Summaries
  app.get("/api/orders", requireAuth, (req, res) => res.json(getOrders()));
  app.post("/api/orders/reset", requireAuth, (req, res, next) => {
    try {
      db.transaction(() => {
        db.prepare("DELETE FROM orders").run();
        db.prepare("DELETE FROM daily_summaries").run();
      })();
      invalidateMenuCache();
      broadcast({ type: "INITIAL_STATE", menu: getMenu(db), orders: [], kioskOpen, cards: [] });
      res.json({ success: true });
    } catch (err: any) {
      next(err);
    }
  });

  app.get("/api/summaries", requireAuth, (req, res) => {
    const summaries = db.prepare("SELECT * FROM daily_summaries ORDER BY date DESC LIMIT 30").all();
    res.json(summaries);
  });

  app.get("/api/summaries/:date", requireAuth, (req, res, next) => {
    try {
      const { date } = req.params;
      const orders = db.prepare("SELECT items FROM orders WHERE date = ?").all(date) as any[];
      
      const itemMap: Record<string, { name: string, quantity: number, total: number, price: number, category: string }> = {};
      
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
          });
        }
      });
      
      res.json(Object.values(itemMap).sort((a, b) => b.total - a.total));
    } catch (err: any) {
      next(err);
    }
  });

  app.get("/api/history", requireAuth, (req, res, next) => {
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
  });

  // --- Global Error Handler ---
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[Global Error]", err);
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: "An unexpected error occurred",
      path: req.path
    });
  });

  // --- WebSocket ---
  wss.on("connection", (ws, req) => {
    const origin = req.headers.origin;
    
    // Check access
    if (!globalAccessConfig && !isLocalOrigin(origin)) {
      console.warn(`[WS] Rejected: "${origin}". (Global Access is DISABLED)`);
      ws.close(4003, "Access Denied: Global Access is disabled.");
      return;
    }

    console.log(`[WS] Client connected from ${origin || 'local'}`);
    ws.send(JSON.stringify({
      type: "INITIAL_STATE",
      menu: getMenu(db),
      orders: [], // Removed for security, fetch via API
      kioskOpen,
      cards: [] // Removed for security, fetch via API
    }));
    ws.on("close", () => console.log("[WS] Client disconnected"));
  });

  // --- Static Files & Vite ---
  if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === "production") {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  if (process.env.NODE_ENV !== "test") {
    server.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
    });
  }
  return app;
}


if (process.env.NODE_ENV !== "test") {
  appPromise.catch(err => {
    console.error("[Fatal Error]", err);
    process.exit(1);
  });
}


