# API route rules

- Route Handlers run on the Node.js runtime by default. Use another runtime only for a documented reason.
- Validate all request bodies, query parameters and external API payloads at the boundary before using them.
- Authenticate bearer tokens with the shared helpers in `lib/supabaseAdmin.ts` and authorize couple membership before reading or writing couple-owned data.
- Apply the shared fail-closed rate limiter to abuse-sensitive or write-heavy endpoints.
- Keep service-role clients server-only. Never return credentials, raw provider errors or private database details to the browser.
- Use stable, minimal response shapes and appropriate 4xx/5xx status codes.
- Add focused tests for successful requests, malformed input, unauthenticated access and cross-couple access.
