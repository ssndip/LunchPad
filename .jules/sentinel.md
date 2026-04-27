## 2026-04-22 - Prevent TypeError DoS via Express request payload injection
**Vulnerability:** Calling string methods (`.replace()`, `.trim()`) on request parameters (like `req.query.rfid` or `req.params.rfid`) without type validation.
**Learning:** `express.urlencoded({ extended: true })` and `express.json()` allow attackers to send objects or arrays instead of primitive string values. Calling string methods on these directly causes an unhandled `TypeError: .replace is not a function`, leading to crashes or 500 errors.
**Prevention:** Always cast user input to strings using `String(value)` or validate `typeof value === 'string'` before applying string manipulation functions in Express controllers.
## 2026-04-22 - Prevent TypeError DoS via Express request payload injection
**Vulnerability:** Calling string methods (`.replace()`, `.trim()`) on request parameters (like `req.query.rfid` or `req.params.rfid`) without type validation.
**Learning:** `express.urlencoded({ extended: true })` and `express.json()` allow attackers to send objects or arrays instead of primitive string values. Calling string methods on these directly causes an unhandled `TypeError: .replace is not a function`, leading to crashes or 500 errors.
**Prevention:** Always cast user input to strings using `String(value)` or validate `typeof value === 'string'` before applying string manipulation functions in Express controllers.
## 2026-04-22 - Prevent Authorization Bypass via Host Header Spoofing
**Vulnerability:** `adminWhitelistGuard` implicitly trusts `req.hostname === "localhost"` while the Express app has `trust proxy` enabled (`app.set("trust proxy", 1)`).
**Learning:** When `trust proxy` is enabled, Express derives `req.hostname` from the `X-Forwarded-Host` or `Host` headers. An attacker can set `X-Forwarded-Host: localhost` on an external request. The middleware then checks `clientHostname === "localhost"` and allows the request, bypassing the intended IP whitelist restrictions for the administration panel.
**Prevention:** Never use `req.hostname === "localhost"` for access control when `trust proxy` is enabled. Rely only on secure IP evaluation (`req.ip` matching `127.0.0.1` or `::1`), as `req.ip` correctly extracts the IP from `X-Forwarded-For` using the defined trusted proxy logic.
