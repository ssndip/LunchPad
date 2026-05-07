
import Database from 'better-sqlite3';
const db = new Database('./data/lunchpad.db');
const categories = db.prepare('SELECT * FROM categories').all();
console.log(JSON.stringify(categories, null, 2));
db.close();
