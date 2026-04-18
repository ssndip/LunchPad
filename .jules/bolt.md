## 2025-02-12 - Prevent RegExp Recompilation Inside Parsing Loops
**Learning:** Calling `new RegExp()` repeatedly inside inner loops of text parsing engines creates significant CPU overhead due to continuous regex compilation. Additionally, `MenuParserEngine` was recompiling patterns globally configured per-instance.
**Action:** Always precompile and cache `RegExp` instances as class properties or within module scope when configurations or patterns are static for the lifecycle of the object. When using global (`/g`) flags, ensure they are used safely (e.g. within `String.replace`) to avoid `lastIndex` pollution across iterations.
## 2025-02-12 - Prevent Full Table Scans with Expression Indexes
**Learning:** Querying indexed columns using functions like `LOWER()` in `WHERE` clauses (e.g. `WHERE LOWER(rfid) = ?`) bypasses standard B-Tree indexes, resulting in O(N) full table scans. This scales poorly for unbounded tables like historical orders.
**Action:** Use expression-based indexes (e.g., `CREATE INDEX ON table(LOWER(column))`) or normalize data on insertion to prevent full table scans and allow O(1) index lookups.
