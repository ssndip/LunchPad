## 2025-03-09 - Missing Rate Limiter Middleware
**Vulnerability:** A rate limiter was configured but never applied to the Express application pipeline using `app.use()`.
**Learning:** Middleware configurations in Express must be explicitly attached to the request pipeline to be effective. Merely instantiating them does nothing.
**Prevention:** Always verify that security middleware is both configured and injected into `app` with `app.use()`.
