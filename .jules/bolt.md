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
## 2026-04-02 - Expression Indexing for Case-Insensitive Lookups
**Learning:** Changing database schema queries from `LOWER(col) = ?` to `col = ?` to enable indexing can introduce critical regressions if existing database records contain unnormalized (e.g., mixed-case) data that requires the lowercase cast to match successfully.
**Action:** Use an SQLite expression index (e.g., `CREATE INDEX ON table(LOWER(column))`) to achieve O(1) performance for case-insensitive queries while safely maintaining full backward compatibility with any unnormalized historical data.
