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
db.pragma('foreign_keys = ON');

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

  // --- Database Migrations ---
  const migrations = [
    { name: "isAdmin", sql: "ALTER TABLE cards ADD COLUMN isAdmin INTEGER DEFAULT 0" },
    { name: "pin", sql: "ALTER TABLE cards ADD COLUMN pin TEXT" },
    { name: "requiresSideChoice", sql: "ALTER TABLE menu ADD COLUMN requiresSideChoice INTEGER DEFAULT 0" },
    { name: "sideChoices", sql: "ALTER TABLE menu ADD COLUMN sideChoices TEXT" },
    { name: "selectedSide", sql: "ALTER TABLE menu ADD COLUMN selectedSide TEXT" },
    { name: "hasIncludedSide", sql: "ALTER TABLE menu ADD COLUMN hasIncludedSide INTEGER DEFAULT 0" },
    { name: "tags", sql: "ALTER TABLE menu ADD COLUMN tags TEXT" },
    { name: "packagingFee", sql: "ALTER TABLE menu ADD COLUMN packagingFee REAL" },
    { name: "feeDistributed", sql: "ALTER TABLE daily_summaries ADD COLUMN feeDistributed INTEGER DEFAULT 0" },
    { name: "distributedAmount", sql: "ALTER TABLE daily_summaries ADD COLUMN distributedAmount REAL DEFAULT 0" }
  ];

  migrations.forEach(m => {
    try {
      db.exec(m.sql);
      console.log(`[DB] Migration applied: ${m.name}`);
    } catch (e) {
      // Column likely already exists
    }
  });

  console.log("[DB] Schema verification complete");

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
      orderCount INTEGER DEFAULT 0,
      feeDistributed INTEGER DEFAULT 0,
      distributedAmount REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- ⚡ Bolt: Indexes for O(1) descending sorts & filters
    CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date DESC);
    CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(date DESC);

    -- ⚡ Bolt: Index for O(1) lookup of lowercased RFIDs
    CREATE INDEX IF NOT EXISTS idx_cards_lower_rfid ON cards(LOWER(rfid));

    -- Parser System Tables
    CREATE TABLE IF NOT EXISTS parser_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'draft',
      isActive INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS parser_versions (
      id TEXT PRIMARY KEY,
      profileId TEXT NOT NULL,
      versionNumber INTEGER NOT NULL,
      configJson TEXT NOT NULL,
      changeNote TEXT,
      createdAt TEXT,
      FOREIGN KEY(profileId) REFERENCES parser_profiles(id)
    );

    CREATE INDEX IF NOT EXISTS idx_parser_versions_profile ON parser_versions(profileId);

    CREATE TABLE IF NOT EXISTS parser_fixtures (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rawInput TEXT NOT NULL,
      expectedOutputJson TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS parser_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT,
      rawInput TEXT,
      unmatchedLines TEXT,
      configId TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_parser_logs_timestamp ON parser_logs(timestamp DESC);

    CREATE TABLE IF NOT EXISTS custom_languages (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      translations TEXT NOT NULL -- JSON string
    );
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

  // Seed Default Parser Profile
  const countProfiles = db.prepare("SELECT COUNT(*) as count FROM parser_profiles").get() as { count: number };
  if (countProfiles.count === 0) {
    const profileId = 'default-profile-uuid';
    const versionId = 'default-version-uuid';
    const defaultConfig = {
      version: 1,
      language: 'bg',
      preprocessing: [
        { id: 'trim', type: 'trim' },
        { id: 'norm_ws', type: 'normalize_whitespace' },
        { id: 'bgn_noise', type: 'remove', pattern: '[\\d]+[,.][\\d]+\\s*(?:лв|лева|лв\\.)' }
      ],
      ignoreRules: [{ id: 'empty', pattern: '^\\s*$' }],
      sectionDetection: [
        { id: 'soups', categoryName: 'Soups', pattern: 'супи', applyBoxFeeByDefault: false },
        { id: 'mains', categoryName: 'Main Dishes', pattern: 'основни ястия|основно ястие', applyBoxFeeByDefault: false },
        { id: 'salads', categoryName: 'Salads', pattern: 'салати', applyBoxFeeByDefault: true },
        { id: 'bread', categoryName: 'Bread', pattern: 'хляб', applyBoxFeeByDefault: false },
        { id: 'desserts', categoryName: 'Desserts', pattern: 'десерти', applyBoxFeeByDefault: false },
        { id: 'sides', categoryName: 'Side Dishes', pattern: 'гарнитури', applyBoxFeeByDefault: true },
        { id: 'bbq', categoryName: 'BBQ', pattern: 'скара', applyBoxFeeByDefault: true }
      ],
      entityExtraction: {
        datePattern: '(\\d{1,2}[.\\-/]\\d{1,2}[.\\-/]\\d{2,4})',
        weightPattern: '(\\d+\\s*(?:гр|g|gr|мл|ml))',
        pricePattern: '([\\d]+[,.][\\d]+|[\\d]+)\\s*(?:€|\\$)',
        boxFeePattern: '([\\d]+[,.][\\d]+|[\\d]+)\\s*(?:€|\\$)?\\s*кутийка',
        itemPrefixPattern: '^[-•*]\\s*',
        boxKeywordPattern: 'кутийка',
        bgnNoisePattern: '[\\d]+[,.][\\d]+\\s*(?:лв|лева|лв\\.)'
      },
      enrichmentRules: [
        { id: 'autobox_sides', condition: { category: ['Side Dishes', 'Salads'] }, action: { addTag: 'autobox' } },
        { id: 'bbq_tag', condition: { category: ['BBQ'] }, action: { addTag: 'bbq' } }
      ],
      fallbackCategory: 'Other'
    };

    db.transaction(() => {
      db.prepare("INSERT INTO parser_profiles (id, name, description, status, isActive) VALUES (?, ?, ?, 'published', 1)")
        .run(profileId, 'Default Profile', 'Standard menu parsing rules (BG)');
      
      db.prepare("INSERT INTO parser_versions (id, profileId, versionNumber, configJson, changeNote, createdAt) VALUES (?, ?, 1, ?, 'Initial system seed', ?)")
        .run(versionId, profileId, JSON.stringify(defaultConfig), new Date().toISOString());
    })();
    console.log("[DB] Seeded Default Parser Profile");
  }

  // Seed PWA & System Settings
  const initialSettings = [
    { key: 'kioskModeEnabled', value: '0' },
    { key: 'allowPWAInstall', value: '1' },
    { key: 'announcement', value: 'Наско , кога ше пием бира?!' }
  ];
  const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  initialSettings.forEach(s => insertSetting.run(s.key, s.value));
  console.log("[DB] Ensured settings exist");
};
