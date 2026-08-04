# Test rules

- Keep `npm test` deterministic, fast and independent of production services.
- E2E tests that require a service-role key may run only against a dedicated development project with disposable fictional users.
- Cover both allowed and denied access, especially cross-couple reads and writes.
- Use Playwright assertions for behavior. Use visual snapshots only for stable layouts and keep the browser, fonts and viewport deterministic.
- Prefer focused ARIA snapshots over full dynamic-page snapshots.
- Never commit traces, screenshots or fixtures containing real user data or credentials.
