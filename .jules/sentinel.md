## 2024-06-04 - [Exposed Sensitive Data]
**Vulnerability:** The `aiApiKey` was exposed in plain text in the `/api/init` endpoint and WebSocket `INITIAL_STATE` broadcasts.
**Learning:** Returning configuration settings as a flat object may inadvertently include sensitive keys alongside non-sensitive ones if they are not explicitly filtered or masked before serialization.
**Prevention:** Always mask or remove sensitive configuration values (like API keys, passwords, JWT secrets) when returning settings payloads over public endpoints or WebSocket broadcasts. Implement explicit checks in corresponding update controllers to prevent masked placeholders (like `********`) from overwriting valid secrets.
