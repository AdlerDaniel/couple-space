<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Couple Space

## Stack and deployment priority

- Next.js 16 App Router, React 19, TypeScript and Tailwind CSS 4.
- Supabase Auth, Database, Storage and Realtime.
- Vercel is the primary production environment and native `next build` behavior is authoritative.
- Sites/vinext is a secondary test, backup and draft environment. Keep it compatible when practical, but never weaken or redesign the Vercel implementation solely for Sites.

## Required checks

After meaningful code changes run:

1. `npm run typecheck`
2. `npm run lint`
3. `npm test`

Before a production release run `npm run verify:vercel`. After it succeeds, run
`npm run verify:sites` as the secondary compatibility check.

For mobile UI work, also verify the affected flow at 375px, 390px, 768px and a
desktop width. Check both light and dark themes when the page supports them.

## Architecture and security

- Keep route pages focused on orchestration. Move data access, Realtime subscriptions, composers, dialogs and reusable UI into dedicated modules as a page grows.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, private VAPID keys or other server-only credentials to client code, logs or test artifacts.
- All couple-owned data must be authorized by authenticated membership and `couple_id`; authentication alone is not authorization.
- Database schema changes must use reviewed, versioned migrations. Do not mutate production user content unless the user explicitly requests it.
- Regenerate `lib/database.types.ts` after every reviewed database migration.
- Treat messages, answers, memories, media URLs, email addresses and push subscriptions as private data. Do not copy them into telemetry, snapshots, seeds or error reports.
- Do not add a second auth system, ORM, state framework or full UI framework without a concrete need and an explicit migration plan.

## UI rules

- Mobile is a required layout, not a desktop fallback.
- Preserve the page accent, browser scrollbar accent, floating navigation, light theme and dark theme.
- Prefer existing Lucide icons and shared components over new emoji or one-off icon systems.
- Long names, long messages, missing avatars, empty states and the mobile keyboard must not break layout.

## Completion

- Review the final diff and preserve unrelated user changes.
- Report changed files, checks executed and checks that could not be executed.
- Do not claim a deployment, migration, commit or push unless it actually succeeded.
