## 2026-04-17 - Hardcoded JWT Secret Removed
**Vulnerability:** A hardcoded, insecure default string (`"lunchpad-secret-key-123"`) was being used as a fallback for `jwtSecret` when the `JWT_SECRET` environment variable was not set.
**Learning:** Hardcoded secrets in source code present a major security risk, especially in open-source or exposed codebases. If deployed without configuring the environment variable, attackers could easily forge valid JWTs to impersonate admins or bypass authorization checks.
**Prevention:** Never provide fallback values for cryptographic secrets in production configurations. Enforce strict checks that throw an initialization error (`throw new Error(...)`) at startup if critical secrets like `JWT_SECRET` are missing from the environment.
