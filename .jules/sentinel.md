## 2026-04-22 - Prevent TypeError DoS via Express request payload injection
**Vulnerability:** Calling string methods (`.replace()`, `.trim()`) on request parameters (like `req.query.rfid` or `req.params.rfid`) without type validation.
**Learning:** `express.urlencoded({ extended: true })` and `express.json()` allow attackers to send objects or arrays instead of primitive string values. Calling string methods on these directly causes an unhandled `TypeError: .replace is not a function`, leading to crashes or 500 errors.
**Prevention:** Always cast user input to strings using `String(value)` or validate `typeof value === 'string'` before applying string manipulation functions in Express controllers.
## 2026-04-22 - Prevent TypeError DoS via Express request payload injection
**Vulnerability:** Calling string methods (`.replace()`, `.trim()`) on request parameters (like `req.query.rfid` or `req.params.rfid`) without type validation.
**Learning:** `express.urlencoded({ extended: true })` and `express.json()` allow attackers to send objects or arrays instead of primitive string values. Calling string methods on these directly causes an unhandled `TypeError: .replace is not a function`, leading to crashes or 500 errors.
**Prevention:** Always cast user input to strings using `String(value)` or validate `typeof value === 'string'` before applying string manipulation functions in Express controllers.
## 2026-04-25 - Prevent IP Whitelist Bypass via Host Header Spoofing
**Vulnerability:** The `adminWhitelistGuard` implicitly trusted `req.hostname` and allowed bypassing the IP-based whitelist if the client matched an entry (or "localhost") by name. Because the application uses `app.set("trust proxy", 1)`, an attacker could inject `Host` or `X-Forwarded-Host` HTTP headers to spoof `req.hostname`, granting unauthorized access to protected admin routes (e.g., `/api/auth/login`).
**Learning:** Checking hostnames directly against `req.hostname` in a reverse-proxied Express app is fundamentally insecure for IP whitelisting because the value is easily controlled by the client. It also creates a "Hostname trust bypass".
**Prevention:** IP whitelist implementations must strictly validate against `req.ip` and should not support hostname matching unless backed by secure reverse DNS lookups, which are generally impractical.
