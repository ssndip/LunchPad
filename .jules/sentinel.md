## 2024-05-18 - Prevent Sensitive Key Exposure in Broadcasts
**Vulnerability:** The `aiApiKey` secret was being broadcasted in plaintext over unauthenticated WebSockets in the `INITIAL_STATE` payload and via `/api/init` and `fetchSettings` responses.
**Learning:** Configurations mapping wholesale to public endpoints often accidentally leak newly added sensitive administrative fields.
**Prevention:** Always explicitly check and mask sensitive fields (e.g. `'********'`) when broadcasting state, and ensure corresponding update endpoints accept and ignore the masked value to prevent overwriting the real secret.
