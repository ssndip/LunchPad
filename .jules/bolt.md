## 2024-05-18 - Fix N+1 Query in SQLite
**Learning:** Calling `db.prepare` inside a loop within a `db.transaction` for SQLite queries causes severe N+1 compilation overhead (measurably 5x slower), degrading performance when performing batch updates like fee splitting.
**Action:** Always extract the `db.prepare` statement outside the loop but within the transaction function scope (or before it) to ensure the query is compiled only once.
