## 2025-03-01 - Global State Caching and Tests
**Learning:** Caching database query results (like `menu`) into a module-level global variable (`let cachedMenu`) inside `server.ts` breaks test isolation and causes the `vitest` suite to fail when tests re-instantiate the app multiple times with a fresh in-memory `better-sqlite3` instance.
**Action:** Avoid global variables for request-level or dynamic caching in the backend module level. Use app-level locals or a proper cache store, and ensure the cache is explicitly cleared or ignored in testing environments.

## 2025-03-01 - O(n) Array Lookups in React Render Loops
**Learning:** Using `Array.prototype.find()` inside a `map` loop for rendering a list of items is a common React anti-pattern that leads to $O(N^2)$ or $O(N \times M)$ rendering complexity, causing severe performance drops when mapping over frequently changing state.
**Action:** Memoize lookup targets into a `Set` or `Map` using `useMemo` before iterating over the main list in the render function to reduce lookup complexity to $O(1)$.
