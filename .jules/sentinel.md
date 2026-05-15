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
## 2026-04-24 - Hardcoded Fallback JWT Secret
**Vulnerability:** The application used a hardcoded string `"lunchpad-default-dev-secret-key-12345"` as a fallback for the JWT secret if `process.env.JWT_SECRET` was not provided.
**Learning:** Hardcoded secrets in code repositories are easily discoverable and can be exploited to forge JWT tokens, leading to full authentication bypass. Relying on developers to "remember" to set secrets in production often fails.
**Prevention:** If an environment variable for a secret is missing, fail securely by throwing an error, or if a fallback is absolutely necessary for local development, generate a cryptographically secure random value at runtime (e.g., using `crypto.randomBytes`) so it is unique per instance and unpredictable.
