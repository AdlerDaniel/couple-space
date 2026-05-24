# Supabase migration order

Run SQL files in this order when setting up or repairing the project database.

1. `supabase-memory-upgrades.sql`
2. `supabase-memories-rls-policies.sql`
3. `supabase-memory-images-storage-policies.sql`
4. `supabase-question-media-columns.sql`
5. `supabase-question-social-columns.sql`
6. `supabase-dashboard-status-columns.sql`
7. `supabase-tracker.sql`
8. `supabase-tracker-goals.sql`

Notes:

- `supabase-tracker-goals.sql` is safe to run more than once. It adds missing columns with `if not exists`.
- If goals do not save in `/tracker`, run `supabase-tracker-goals.sql` again.
- If uploaded question media fails, check the `question-media` Storage bucket and run `supabase-question-media-columns.sql`.
- If uploaded memory photos fail with an RLS error, run `supabase-memory-images-storage-policies.sql`.
