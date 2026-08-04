# Supabase database rules

- Use a development project or branch with fictional data for schema iteration, destructive checks and E2E tests.
- Commit schema changes as versioned migrations. Never make an untracked production schema change.
- Enable RLS for every table exposed through the Data API and authorize rows by authenticated pair membership, not only `TO authenticated`.
- UPDATE policies require both `USING` and `WITH CHECK`; UPDATE also needs a matching SELECT policy.
- Treat `SECURITY DEFINER` as exceptional. Set a safe `search_path`, check `auth.uid()`, revoke default `PUBLIC` execution and grant only the required roles.
- New Data API tables may require explicit grants in addition to RLS.
- Run database advisors and negative RLS tests before applying a migration to production.
- Regenerate `lib/database.types.ts` after the migration is applied to the source-of-truth schema.
- Never put production messages, answers, memories, media or push subscriptions in seeds or fixtures.
