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
## 2026-04-24 - AI API Key Masking Enforcement
**Vulnerability:** The application was exposing the plain text `aiApiKey` credential to the frontend via the `/api/init` and `/api/settings` endpoints as well as the `INITIAL_STATE` WebSocket broadcast, enabling information exposure and potential abuse.
**Learning:** Returning unmasked sensitive keys (like API credentials) from public or authenticated bootstrap endpoints exposes them to any inspecting client.
**Prevention:** Always mask sensitive configuration values (e.g., using `"********"`) when returned from the backend. Corresponding update endpoints must explicitly ignore updates where the incoming value is the masked placeholder to avoid destructively overwriting the valid credential in the database.
