import Database from 'better-sqlite3';

const db = new Database(':memory:');

db.exec(`
  CREATE TABLE cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rfid TEXT UNIQUE,
    balance REAL,
    lastUpdated TEXT
  );
`);

const numRows = 10000;
const now = new Date().toISOString();
const splitFee = 1.5;

db.transaction(() => {
  const insertStmt = db.prepare("INSERT INTO cards (rfid, balance, lastUpdated) VALUES (?, ?, ?)");
  for (let i = 0; i < numRows; i++) {
    insertStmt.run(`rfid-${i}`, 0, now);
  }
})();

const rows = Array.from({ length: numRows }).map((_, i) => ({ rfid: `rfid-${i}` }));

// Baseline test
const start1 = process.hrtime.bigint();
db.transaction(() => {
  for (const row of rows) {
    db.prepare("UPDATE cards SET balance = balance + ?, lastUpdated = ? WHERE rfid = ?")
      .run(splitFee, now, row.rfid);
  }
})();
const end1 = process.hrtime.bigint();
console.log(`Baseline (prepare inside loop): ${Number(end1 - start1) / 1_000_000}ms`);

// Optimized test
const start2 = process.hrtime.bigint();
db.transaction(() => {
  const stmt = db.prepare("UPDATE cards SET balance = balance + ?, lastUpdated = ? WHERE rfid = ?");
  for (const row of rows) {
    stmt.run(splitFee, now, row.rfid);
  }
})();
const end2 = process.hrtime.bigint();
console.log(`Optimized (prepare outside loop): ${Number(end2 - start2) / 1_000_000}ms`);
