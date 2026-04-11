## 2024-05-14 - Fix LIKE pattern injection in API

**Vulnerability:** A LIKE pattern injection vulnerability was found in the `ownerName` query parameter of the `/api/history` endpoint in `server.ts`. User input was passed directly into a LIKE clause with surrounding `%` wildcards without escaping special characters like `%` and `_`.
**Learning:** When using user-provided input in SQL `LIKE` clauses, it is crucial to escape special characters (`%`, `_`, and the escape character itself) to prevent 'LIKE pattern injection', which allows users to manipulate the query logic, bypass intended filters, and potentially access unauthorized data or cause denial-of-service via resource exhaustion.
**Prevention:** Always escape special characters (`%`, `_`, and the escape character itself) in user input and include an explicit `ESCAPE` clause in the query when using `LIKE`.
## 2024-05-18 - Prevent Information Leakage in Global Error Handler
**Vulnerability:** The global Express error handler was directly returning `err.message` to the client in HTTP 500 responses. Additionally, many individual route handlers were catching errors and manually sending `res.status(500).json({ error: err.message })`.
**Learning:** Returning unhandled error messages to the client can inadvertently expose sensitive internal details, such as SQL queries, file paths, or third-party API keys, which attackers can use to gain insights into the application's architecture or exploit other vulnerabilities. In this codebase, it's safer to rely on Express 4's built-in synchronous error forwarding by using `next(err)` to route exceptions to a sanitized global handler.
**Prevention:** Always use a sanitized global error handler that returns generic error messages (e.g., "Internal Server Error") for unexpected exceptions. Detailed error information should only be logged server-side via `console.error` or a logging service, never exposed in the HTTP response body.
## 2024-03-30 - Missing Input Validation
**Vulnerability:** User inputs (e.g. `rfid` and `ownerName` in `/api/cards`) are processed and saved to the database without reasonable length limits. An attacker can submit an RFID consisting of 100,000 characters, which gets persisted in the DB.
**Learning:** Even internal or admin-authenticated endpoints can be vectors for resource exhaustion (Denial of Service) if large payloads aren't rejected early.
**Prevention:** Add explicit string length checks to all incoming text fields before passing them to the database.
## 2024-05-20 - Prevent URL Credential Leakage in Authentication
**Vulnerability:** The `requireAuth` middleware in `server.ts` was accepting the admin PIN via the URL query string (`req.query.pin`), which can lead to the sensitive credential being logged in server access logs, proxy logs, and browser history.
**Learning:** Accepting authentication credentials (such as PINs, tokens, or passwords) via URL parameters exposes them to unintended logging mechanisms and potential leakage to third parties. Credentials should always be transmitted via HTTP headers (e.g., Authorization or custom headers like `x-admin-pin`) or in the request body for POST requests.
**Prevention:** Always enforce the use of HTTP headers for transmitting authentication credentials and remove fallback mechanisms that check URL query parameters.

## 2024-05-24 - Unhandled Express TypeErrors via query/body arrays
**Vulnerability:** Endpoints extracting user input (e.g., `rfid`, `ownerName`) from Express `req.query`, `req.body`, or `req.headers` were directly calling string methods like `.trim()`, `.replace()`, and `.toLowerCase()` without type validation.
**Learning:** Express allows clients to send arrays or objects in query parameters (e.g., `?rfid[]=123`) or JSON bodies. If an array or object is passed, string methods will throw a `TypeError` (e.g., `rfid.trim is not a function`), potentially causing unhandled exceptions or resource exhaustion (DoS).
**Prevention:** Always explicitly validate the data type (e.g., `typeof x === 'string'`) before calling string methods on client-provided, database-bound inputs from Express request objects.
