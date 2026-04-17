## 2024-05-24 - Authentication Bypass via Missing Origin Header
**Vulnerability:** The `isLocalOrigin` function returned `true` for missing or `'null'` Origin headers.
**Learning:** This allowed remote clients to bypass authentication and IP whitelisting by omitting the Origin header or sending requests from sandboxed iframes (which send `'null'`).
**Prevention:** Always fail securely by returning `false` for missing or malformed Origin headers when they are used for access control.
