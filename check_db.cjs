const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'data', 'lunchpad.db');
const db = new Database(dbPath);
const card = db.prepare("SELECT * FROM cards WHERE rfid = 'TEST-ADMIN'").get();
console.log('TEST-ADMIN Card:', card);
const settings = db.prepare("SELECT * FROM settings").all();
console.log('System Settings:', settings);
db.close();
