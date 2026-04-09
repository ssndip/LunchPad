import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

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

// Create tables and indexes
export const initDb = () => {
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

  try {
    db.exec("ALTER TABLE menu ADD COLUMN requiresSideChoice INTEGER DEFAULT 0");
    db.exec("ALTER TABLE menu ADD COLUMN sideChoices TEXT");
    db.exec("ALTER TABLE menu ADD COLUMN selectedSide TEXT");
    db.exec("ALTER TABLE menu ADD COLUMN hasIncludedSide INTEGER DEFAULT 0");
    console.log("[DB] Added side-dish columns to menu table");
  } catch (e) {}

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
};

// Seed logic
export const seedInitialData = () => {
  // Seed Menu
  const countMenu = db.prepare("SELECT COUNT(*) as count FROM menu").get() as { count: number };
  if (countMenu.count === 0) {
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

  // Seed Cards
  const countCards = db.prepare("SELECT COUNT(*) as count FROM cards").get() as { count: number };
  if (countCards.count === 0) {
    const initialCards = [
      { rfid: "1234567890", ownerName: "Test User", balance: 0 },
      { rfid: "0987654321", ownerName: "Admin User", balance: 0 }
    ];
    const insert = db.prepare("INSERT INTO cards (rfid, ownerName, balance, lastUpdated) VALUES (?, ?, ?, ?)");
    initialCards.forEach(card => insert.run(card.rfid, card.ownerName, card.balance, new Date().toISOString()));
    console.log("[DB] Seeded initial cards");
  }

  // Seed Test Admin
  const existingAdmin = db.prepare("SELECT * FROM cards WHERE rfid = ?").get("TEST-ADMIN");
  if (!existingAdmin) {
    db.prepare("INSERT INTO cards (rfid, ownerName, balance, isAdmin, lastUpdated) VALUES (?, ?, ?, ?, ?)")
      .run("TEST-ADMIN", "Test Administrator", 999.00, 1, new Date().toISOString());
    console.log("[DB] Seeded TEST-ADMIN card for RFID-less ordering");
  }
};

// Initialize DB and seed initial data automatically
initDb();
seedInitialData();
