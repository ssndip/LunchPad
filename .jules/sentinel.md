## 2026-04-22 - Prevent TypeError DoS via Express request payload injection
**Vulnerability:** Calling string methods (`.replace()`, `.trim()`) on request parameters (like `req.query.rfid` or `req.params.rfid`) without type validation.
**Learning:** `express.urlencoded({ extended: true })` and `express.json()` allow attackers to send objects or arrays instead of primitive string values. Calling string methods on these directly causes an unhandled `TypeError: .replace is not a function`, leading to crashes or 500 errors.
**Prevention:** Always cast user input to strings using `String(value)` or validate `typeof value === 'string'` before applying string manipulation functions in Express controllers.
## 2026-04-22 - Prevent TypeError DoS via Express request payload injection
**Vulnerability:** Calling string methods (`.replace()`, `.trim()`) on request parameters (like `req.query.rfid` or `req.params.rfid`) without type validation.
**Learning:** `express.urlencoded({ extended: true })` and `express.json()` allow attackers to send objects or arrays instead of primitive string values. Calling string methods on these directly causes an unhandled `TypeError: .replace is not a function`, leading to crashes or 500 errors.
**Prevention:** Always cast user input to strings using `String(value)` or validate `typeof value === 'string'` before applying string manipulation functions in Express controllers.
## 2026-04-24 - AI API Key Public Exposure Leak
**Vulnerability:** The application was leaking the `aiApiKey` from the database settings to any public client via the unauthenticated `GET /api/init` bootstrapping endpoint, as it blindly returned all settings.
**Learning:** Sending the entire `settings` object (or an unchecked subset) to unauthenticated public bootstrap endpoints guarantees that newly added sensitive administrative settings will eventually be leaked to the public internet unless they are explicitly filtered out.
**Prevention:** Always implement a strict allow-list for public configuration endpoints. Never spread or pass unchecked backend configuration dictionaries to the frontend. Review the properties mapped onto public init structures when new settings are added.
## 2026-04-24 - Prevent IDOR Brute-Force via Endpoint Rate-Limiting
**Vulnerability:** The public endpoint `GET /api/cards/:rfid/profile` serving the Kiosk `UserHistoryModal` relies on physical RFID possession instead of standard authentication. Without endpoint-specific rate-limiting, attackers could easily brute-force the 10-digit RFID to retrieve any user's profile and order history.
**Learning:** Endpoints meant for unauthenticated hardware integration bypass standard authentication middleware. Relying solely on a global API rate limit (e.g. 5000 requests per 15 minutes) is insufficient to prevent targeted IDOR enumeration attacks on sensitive user profiles.
**Prevention:** Apply endpoint-specific rate-limiting (e.g. `express-rate-limit` allowing ~30 requests per 5 minutes) directly on sensitive unauthenticated routes. Ensure local/whitelisted IPs are explicitly exempted to prevent locking out valid admin/Kiosk hardware requests.
