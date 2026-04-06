## 2025-03-01 - Global State Caching and Tests
**Learning:** Caching database query results (like `menu`) into a module-level global variable (`let cachedMenu`) inside `server.ts` breaks test isolation and causes the `vitest` suite to fail when tests re-instantiate the app multiple times with a fresh in-memory `better-sqlite3` instance.
**Action:** Avoid global variables for request-level or dynamic caching in the backend module level. Use app-level locals or a proper cache store, and ensure the cache is explicitly cleared or ignored in testing environments.

## 2025-03-01 - O(n) Array Lookups in React Render Loops
**Learning:** Using `Array.prototype.find()` inside a `map` loop for rendering a list of items is a common React anti-pattern that leads to $O(N^2)$ or $O(N \times M)$ rendering complexity, causing severe performance drops when mapping over frequently changing state.
**Action:** Memoize lookup targets into a `Set` or `Map` using `useMemo` before iterating over the main list in the render function to reduce lookup complexity to $O(1)$.

## 2025-03-01 - O(N) Database Sorting Without Indexes
**Learning:** Using `ORDER BY timestamp DESC` and `ORDER BY date DESC` repeatedly on unindexed tables (`orders` and `daily_summaries`) leads to O(N) performance drops as those tables grow (which they do rapidly, since every transaction is a row). The backend fetches latest orders heavily via the WebSocket and `/api/history` routes.
**Action:** Add a `DESC` B-Tree index to frequently sorted tables to reduce sorting queries to O(1) reads, especially when sorting alongside pagination (`LIMIT`).

## 2025-03-01 - Preventing Full App 1-Second Re-renders
**Learning:** Keeping a  state updated via a 1-second interval at the top-level of a complex React app causes the entire tree to re-render 60 times a minute. This wastes CPU and causes UI stuttering.
**Action:** Extract rapidly updating states (like a live clock) into isolated micro-components (e.g., `<SystemClock />`) and memoize time-based computations (e.g., `useMemo` on a 60-second tick) so the main app only re-renders when necessary.

## 2025-03-31 - Preventing Full App 1-Second Re-renders
**Learning:** Keeping a `systemTime` state updated via a 1-second interval at the top-level of a complex React app causes the entire tree to re-render 60 times a minute. This wastes CPU and causes UI stuttering.
**Action:** Extract rapidly updating states (like a live clock) into isolated micro-components (e.g., `<SystemClock />`) and memoize time-based computations (e.g., `useMemo` on a 60-second tick) so the main app only re-renders when necessary.

## 2024-05-28 - Indexing Expression Functions in SQLite
**Learning:** Queries that use functions on columns in the `WHERE` clause (like `WHERE LOWER(rfid) = ?`) bypass standard column indexes (like a `PRIMARY KEY` on `rfid`), resulting in a full table scan (`SCAN table`).
**Action:** Always add expression-based indexes (e.g., `CREATE INDEX ON table(LOWER(column))`) when querying with functions to ensure O(1) or O(log N) lookup time instead of O(N) table scans.

## 2024-05-28 - Compound Indexes for Filtering and Sorting
**Learning:** For queries that filter and sort on different columns (e.g., `WHERE LOWER(rfid) = ? ORDER BY timestamp DESC`), SQLite will only use an index for the filter condition (if available) and then perform a full sort (`USE TEMP B-TREE FOR ORDER BY`).
**Action:** Always create a compound index encompassing both the filter function/column and the sort direction (e.g., `CREATE INDEX ON orders(LOWER(rfid), timestamp DESC)`) to achieve O(1) filtering and O(1) sorting, eliminating temporary B-trees in large tables.
