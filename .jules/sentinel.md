## 2025-02-27 - Express Rate Limit Bypass via trust proxy
**Vulnerability:** IP-based rate limiting implemented using `express-rate-limit` was easily bypassable because `app.set('trust proxy', true)` was used. This instructed Express to trust the entire `X-Forwarded-For` chain, allowing an attacker to spoof their IP address by simply injecting a fake `X-Forwarded-For` header in their request.
**Learning:** Setting `trust proxy` to `true` is dangerous when using IP-based security middleware behind a reverse proxy. It trusts all upstream IP addresses, including those supplied by the client.
**Prevention:** When deployed behind a single reverse proxy (like Nginx or Cloudflare), always set `app.set('trust proxy', 1)`. This tells Express to trust only the immediate upstream proxy, ensuring the rate limiter uses the correct, unforgeable client IP provided by that proxy. Additionally, ensure the rate limit middleware is actually injected into the application using `app.use(limiter)`.

## 2026-04-17 - Rate Limiter Integration Bypass
**Vulnerability:** Global rate limiter was defined but bypassed since it was mapped after route-level and json middleware blocks. This rendered rate limiting ineffective on core API endpoints.
**Learning:** Placement within the Express middleware stack matters. The order is procedural, so any `app.use()` calls for routes positioned *before* the limiter definition would bypass its protection against DoS/brute-force attacks.
**Prevention:** Ensure that global security middleware, like `rateLimit`, are positioned *before* API routes, body parsers, and other downstream processors.

## 2026-04-19 - Type Confusion DoS in Express Request Handlers
**Vulnerability:** API endpoints extracted fields like `pin` or `rfid` from `req.body` and `req.query` and directly invoked string methods like `.trim()` or `.replace()` on them without type validation. An attacker could intentionally submit a JSON array or object (e.g., `{"rfid": [1, 2, 3]}`) to trigger an unhandled `TypeError` (e.g., `rfid.trim is not a function`), crashing the Express server and causing a Denial of Service (DoS).
**Learning:** Express body parsers (like `express.json()`) parse JSON transparently. They do not enforce primitive types on payload fields unless explicitly validated. By trusting that `req.body` properties are strings, the server becomes vulnerable to type confusion.
**Prevention:** Always explicitly validate the data type of input parameters (e.g., `if (typeof rfid !== 'string') return res.status(400)`) or safely cast them (e.g., `String(rfid)`) before calling string-specific operations.
