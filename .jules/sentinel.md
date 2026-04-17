## 2026-04-17 - Secure Admin PIN Fallback
**Vulnerability:** Hardcoded admin PIN fallback ('0000') permitted unauthorized admin access if the environment variable wasn't set.
**Learning:** Default fallbacks must not grant privileged access in production.
**Prevention:** Generate secure, random credentials dynamically (e.g., via `crypto.randomInt()`) on startup if explicit ones aren't provided, and print them securely to the logs for initial use. Keep static mock credentials restricted strictly to `NODE_ENV === 'test'` boundaries.
