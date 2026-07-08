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

## 2024-07-08 - Mask Sensitive API Keys in API Endpoints and WebSockets
**Vulnerability:** The AI API Key (`aiApiKey`) was exposed in plain text in the WebSocket `INITIAL_STATE` broadcast payload, as well as the `/api/init` and `/api/settings` GET/POST endpoints, allowing any connected client to extract the sensitive configuration value.
**Learning:** Returning full configuration objects indiscriminately exposes secrets that should remain on the server, especially in generic bootstrap requests.
**Prevention:** Always mask sensitive values like API keys (e.g., using `********`) when sending configuration objects to the frontend. Ensure the backend handles the masked placeholder gracefully during settings updates, explicitly ignoring the `********` value so it doesn't accidentally overwrite the valid secret in the database.
