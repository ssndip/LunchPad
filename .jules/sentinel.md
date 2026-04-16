## 2024-04-16 - Enforce Express Rate Limiter
**Vulnerability:** Global rate limiter was defined via `express-rate-limit` but never applied to the application, leaving endpoints vulnerable to brute-force and DoS attacks.
**Learning:** Initializing middleware variables without using `app.use()` is a common oversight that silently disables intended security measures.
**Prevention:** Always verify that defined security middleware instances are actually registered in the Express routing pipeline.
