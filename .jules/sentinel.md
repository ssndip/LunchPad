## 2025-04-15 - Unapplied Rate Limiter and Hardcoded Secrets
**Vulnerability:** Found an unused instance of `express-rate-limit` in `server.ts` that was never mounted, and a hardcoded fallback JWT secret in `server/config.ts`.
**Learning:** Security middleware must actually be applied to routes using `app.use()` to be effective. Hardcoded fallback secrets defeat the purpose of environment variables by allowing predictable token generation if the environment variable is missing.
**Prevention:** Always verify middleware application (e.g., `app.use('/api/auth', limiter)`) during setup. Use cryptographically secure random fallbacks (e.g., `crypto.randomBytes()`) for sensitive secrets rather than static strings.
