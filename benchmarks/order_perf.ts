import Database from 'better-sqlite3';

const db = new Database(':memory:');

// Schema setup
db.exec(`
  CREATE TABLE cards (rfid TEXT PRIMARY KEY, ownerName TEXT, balance REAL, lastUpdated TEXT);
  CREATE TABLE orders (id TEXT PRIMARY KEY, rfid TEXT, ownerName TEXT, items TEXT, totalPrice REAL, timestamp TEXT, date TEXT, status TEXT);
  CREATE TABLE daily_summaries (date TEXT PRIMARY KEY, totalSales REAL DEFAULT 0, orderCount INTEGER DEFAULT 0);
`);

// Dummy data
db.prepare("INSERT INTO cards (rfid, ownerName, balance, lastUpdated) VALUES (?, ?, ?, ?)").run("123", "Test", 0, new Date().toISOString());

const total = 10;
const now = new Date();
const dateStr = now.toISOString().split('T')[0];
const rfid = "123";
const ownerName = "Test";
const itemsJson = JSON.stringify([{ id: 1, name: "Item", price: 10 }]);

function benchmarkLocal() {
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
        const orderId = `ORD-${i}`;
        db.transaction(() => {
            db.prepare("UPDATE cards SET balance = balance + ?, lastUpdated = ? WHERE rfid = ?")
              .run(total, now.toISOString(), rfid);

            db.prepare("INSERT INTO orders (id, rfid, ownerName, items, totalPrice, timestamp, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
              .run(orderId, rfid, ownerName, itemsJson, total, now.toISOString(), dateStr, "completed");

            const summary = db.prepare("SELECT * FROM daily_summaries WHERE date = ?").get(dateStr) as any;
            if (!summary) {
              db.prepare("INSERT INTO daily_summaries (date, totalSales, orderCount) VALUES (?, ?, ?)")
                .run(dateStr, total, 1);
            } else {
              db.prepare("UPDATE daily_summaries SET totalSales = totalSales + ?, orderCount = orderCount + 1 WHERE date = ?")
                .run(total, dateStr);
            }
        })();
    }
    const end = performance.now();
    return end - start;
}

const updateCardStmt = db.prepare("UPDATE cards SET balance = balance + ?, lastUpdated = ? WHERE rfid = ?");
const insertOrderStmt = db.prepare("INSERT INTO orders (id, rfid, ownerName, items, totalPrice, timestamp, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
const getSummaryStmt = db.prepare("SELECT * FROM daily_summaries WHERE date = ?");
const insertSummaryStmt = db.prepare("INSERT INTO daily_summaries (date, totalSales, orderCount) VALUES (?, ?, ?)");
const updateSummaryStmt = db.prepare("UPDATE daily_summaries SET totalSales = totalSales + ?, orderCount = orderCount + 1 WHERE date = ?");

function benchmarkHoisted() {
    const start = performance.now();
    for (let i = 10000; i < 20000; i++) {
        const orderId = `ORD-${i}`;
        db.transaction(() => {
            updateCardStmt.run(total, now.toISOString(), rfid);
            insertOrderStmt.run(orderId, rfid, ownerName, itemsJson, total, now.toISOString(), dateStr, "completed");

            const summary = getSummaryStmt.get(dateStr) as any;
            if (!summary) {
              insertSummaryStmt.run(dateStr, total, 1);
            } else {
              updateSummaryStmt.run(total, dateStr);
            }
        })();
    }
    const end = performance.now();
    return end - start;
}

console.log("Starting benchmarks...");
const localTime = benchmarkLocal();
console.log(`Local prepare time: ${localTime.toFixed(2)}ms`);

const hoistedTime = benchmarkHoisted();
console.log(`Hoisted prepare time: ${hoistedTime.toFixed(2)}ms`);

const improvement = ((localTime - hoistedTime) / localTime) * 100;
console.log(`Improvement: ${improvement.toFixed(2)}%`);
