## 2025-03-09 - N+1 database queries on JSON string payloads
**Learning:** Returning parsed JSON string values dynamically from SQLite via node-sqlite or better-sqlite3 mapping in Javascript is prone to extreme performance penalties when scaling (large memory payload and parse penalties per row).
**Action:** Use native SQL JSON functions such as `json_array_length()` directly in queries to extract properties from stored JSON instead of using application space to parse them.
