const Database = require('better-sqlite3');
const db = new Database(':memory:');

db.exec(`
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
  CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders(timestamp DESC);
`);

console.log("Without date index:");
const stmt1 = db.prepare("EXPLAIN QUERY PLAN SELECT items FROM orders WHERE date = ?");
console.log(stmt1.all('2023-10-01'));

db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);`);

console.log("With date index:");
const stmt2 = db.prepare("EXPLAIN QUERY PLAN SELECT items FROM orders WHERE date = ?");
console.log(stmt2.all('2023-10-01'));
