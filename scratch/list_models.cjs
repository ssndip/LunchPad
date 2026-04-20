const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = '/home/ssndip/lunchpadgit/server/data/lunchpad.db';
const db = new sqlite3.Database(dbPath);

db.get("SELECT value FROM settings WHERE key = 'ai_api_key'", (err, row) => {
  if (err || !row) {
    console.error("Could not find AI API Key in DB");
    process.exit(1);
  }
  const apiKey = row.value;
  console.log("Found API Key (length:", apiKey.length, ")");
  
  fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    .then(r => r.json())
    .then(data => {
      console.log("Available Models:");
      if (data.models) {
        data.models.forEach(m => console.log(`- ${m.name}`));
      } else {
        console.log(JSON.stringify(data, null, 2));
      }
      process.exit(0);
    })
    .catch(e => {
      console.error("Error fetching models:", e);
      process.exit(1);
    });
});
