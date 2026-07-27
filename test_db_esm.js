import DatabaseConstructor from "better-sqlite3";
const Database = (DatabaseConstructor as any).default || DatabaseConstructor;
try {
  const db = new Database(":memory:");
  console.log("Success! Database initialized.");
  db.close();
} catch (e) {
  console.error("Failed!", e);
}
