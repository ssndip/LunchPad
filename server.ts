import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
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
const dbPath = path.join(DB_DIR, 'lunchpad.db');
console.log(`[DB] Initializing database at: ${dbPath}`);
const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    rfid TEXT PRIMARY KEY,
    ownerName TEXT NOT NULL,
    balance REAL DEFAULT 0,
    lastUpdated TEXT
  );

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
`);

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

// --- Server Setup ---
async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(cors());
  app.use(express.json());

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

  const getMenu = () => {
    const items = db.prepare("SELECT * FROM menu").all() as any[];
    return items.map(i => ({ ...i, available: i.available === 1 }));
  };

  const getCards = () => {
    return db.prepare("SELECT * FROM cards").all();
  };

  const getOrders = (limit = 50) => {
    const orders = db.prepare("SELECT * FROM orders ORDER BY timestamp DESC LIMIT ?").all(limit) as any[];
    return orders.map(o => ({ ...o, items: JSON.parse(o.items) }));
  };

  // --- API Routes ---

  // Health check
  app.get("/ping", (req, res) => res.send("pong"));

  // Kiosk Status
  app.get("/api/status", (req, res) => res.json({ kioskOpen }));
  app.post("/api/status", (req, res) => {
    kioskOpen = !!req.body.open;
    broadcast({ type: "STATUS_UPDATE", data: { kioskOpen } });
    res.json({ success: true, kioskOpen });
  });

  // Menu Management
  app.get("/api/menu", (req, res) => res.json(getMenu()));
  app.post("/api/menu", (req, res) => {
    try {
      const items = req.body;
      db.transaction(() => {
        db.prepare("DELETE FROM menu").run();
        const insert = db.prepare("INSERT INTO menu (id, name, description, price, available, category) VALUES (?, ?, ?, ?, ?, ?)");
        items.forEach((i: any) => insert.run(i.id, i.name, i.description, i.price, i.available ? 1 : 0, i.category));
      })();
      const updated = getMenu();
      broadcast({ type: "MENU_UPDATE", data: updated });
      res.json({ success: true, menu: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Card Management
  app.get("/api/cards", (req, res) => res.json(getCards()));

  // Add/Update single card
  app.post("/api/cards", (req, res) => {
    try {
      const { rfid, ownerName, balance } = req.body;
      if (!rfid || !ownerName) {
        return res.status(400).json({ error: "RFID and ownerName are required" });
      }
      const now = new Date().toISOString();
      const cleanRfid = rfid.trim().replace(/[^\x20-\x7E]/g, '').toLowerCase();
      db.prepare(`
        INSERT INTO cards (rfid, ownerName, balance, lastUpdated)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(rfid) DO UPDATE SET
          ownerName = excluded.ownerName,
          balance = excluded.balance,
          lastUpdated = excluded.lastUpdated
      `).run(cleanRfid, ownerName, balance || 0, now);
      
      const updated = getCards();
      broadcast({ type: "CARDS_UPDATE", data: updated });
      res.json({ success: true, cards: updated });
    } catch (err: any) {
      console.error("[Card Add Error]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Batch add cards
  app.post("/api/cards/batch", (req, res) => {
    try {
      const cards = req.body;
      if (!Array.isArray(cards)) {
        return res.status(400).json({ error: "Expected an array of cards" });
      }
      const now = new Date().toISOString();
      db.transaction(() => {
        const insert = db.prepare(`
          INSERT INTO cards (rfid, ownerName, balance, lastUpdated)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(rfid) DO UPDATE SET
            ownerName = excluded.ownerName,
            balance = excluded.balance,
            lastUpdated = excluded.lastUpdated
        `);
        cards.forEach((c: any) => insert.run(c.rfid.trim(), c.ownerName, c.balance || 0, now));
      })();
      const updated = getCards();
      broadcast({ type: "CARDS_UPDATE", data: updated });
      res.json({ success: true, cards: updated });
    } catch (err: any) {
      console.error("[Card Batch Error]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Delete card
  app.delete("/api/cards/:rfid", (req, res) => {
    try {
      const { rfid } = req.params;
      db.prepare("DELETE FROM cards WHERE rfid = ?").run(rfid);
      const updated = getCards();
      broadcast({ type: "CARDS_UPDATE", data: updated });
      res.json({ success: true, cards: updated });
    } catch (err: any) {
      console.error("[Card Delete Error]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Update all cards (bulk update/replace)
  app.post("/api/cards/update", (req, res) => {
    try {
      const cards = req.body;
      if (!Array.isArray(cards)) {
        return res.status(400).json({ error: "Expected an array of cards" });
      }
      db.transaction(() => {
        db.prepare("DELETE FROM cards").run();
        const insert = db.prepare("INSERT INTO cards (rfid, ownerName, balance, lastUpdated) VALUES (?, ?, ?, ?)");
        const now = new Date().toISOString();
        cards.forEach((c: any) => insert.run(c.rfid.trim(), c.ownerName, c.balance || 0, now));
      })();
      const updated = getCards();
      broadcast({ type: "CARDS_UPDATE", data: updated });
      res.json({ success: true, cards: updated });
    } catch (err: any) {
      console.error("[Card Update Error]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Reset all balances (monthly clear)
  app.post("/api/cards/reset-all", (req, res) => {
    try {
      db.prepare("UPDATE cards SET balance = 0, lastUpdated = ?").run(new Date().toISOString());
      const updated = getCards();
      broadcast({ type: "CARDS_UPDATE", data: updated });
      res.json({ success: true, cards: updated });
    } catch (err: any) {
      console.error("[Card Reset Error]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Reset all balances (monthly clear)
  app.post("/api/cards/reset-all", (req, res) => {
    try {
      db.prepare("UPDATE cards SET balance = 0, lastUpdated = ?").run(new Date().toISOString());
      const updated = getCards();
      broadcast({ type: "CARDS_UPDATE", data: updated });
      res.json({ success: true, cards: updated });
    } catch (err: any) {
      console.error("[Card Reset Error]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Order Processing
  app.post("/api/v1/order", (req, res) => {
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

      const menu = getMenu();
      const itemIdSet = new Set(itemIds);
      const selectedItems = menu.filter(m => itemIdSet.has(m.id));
      if (selectedItems.length === 0) return res.status(400).json({ error: "No valid items selected" });

      const total = selectedItems.reduce((sum, i) => sum + i.price, 0);
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
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

      broadcast({ type: "NEW_ORDER", data: newOrder });
      broadcast({ type: "CARDS_UPDATE", data: getCards() });
      res.json({ success: true, order: newOrder });

    } catch (err: any) {
      console.error("[Order Error]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // History & Summaries
  app.get("/api/orders", (req, res) => res.json(getOrders()));
  app.post("/api/orders/reset", (req, res) => {
    try {
      db.transaction(() => {
        db.prepare("DELETE FROM orders").run();
        db.prepare("DELETE FROM daily_summaries").run();
      })();
      broadcast({ type: "INITIAL_STATE", menu: getMenu(), orders: [], kioskOpen, cards: getCards() });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/summaries", (req, res) => {
    const summaries = db.prepare("SELECT * FROM daily_summaries ORDER BY date DESC LIMIT 30").all();
    res.json(summaries);
  });

  app.get("/api/history", (req, res) => {
    const { startDate, endDate, rfid, ownerName } = req.query;
    let sql = "SELECT * FROM orders WHERE 1=1";
    const params: any[] = [];

    if (startDate) { sql += " AND date >= ?"; params.push(startDate); }
    if (endDate) { sql += " AND date <= ?"; params.push(endDate); }
    if (rfid) { sql += " AND rfid = ?"; params.push(rfid); }
    if (ownerName) { sql += " AND ownerName LIKE ?"; params.push(`%${ownerName}%`); }

    sql += " ORDER BY timestamp DESC LIMIT 100";
    const orders = db.prepare(sql).all(...params) as any[];
    res.json(orders.map(o => ({ ...o, items: JSON.parse(o.items) })));
  });

  // --- WebSocket ---
  wss.on("connection", (ws) => {
    console.log("[WS] Client connected");
    ws.send(JSON.stringify({
      type: "INITIAL_STATE",
      menu: getMenu(),
      orders: getOrders(),
      kioskOpen,
      cards: getCards()
    }));
    ws.on("close", () => console.log("[WS] Client disconnected"));
  });

  // --- Static Files & Vite ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3003;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("[Fatal Error]", err);
  process.exit(1);
});
