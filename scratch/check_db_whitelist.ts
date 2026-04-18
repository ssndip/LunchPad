import Database from "better-sqlite3";
const db = new Database("data/lunchpad.db");
const row = db.prepare("SELECT value FROM settings WHERE key = 'admin_whitelist'").get() as any;
console.log("adminWhitelist from DB:", row ? row.value : "NOT FOUND");
