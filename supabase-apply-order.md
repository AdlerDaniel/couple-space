# Supabase migration order

Run SQL files in this order when setting up or repairing the project database.

1. `supabase-memory-upgrades.sql`
2. `supabase-question-media-columns.sql`
3. `supabase-question-social-columns.sql`
4. `supabase-dashboard-status-columns.sql`
5. `supabase-tracker.sql`
6. `supabase-tracker-goals.sql`

Notes:

- `supabase-tracker-goals.sql` is safe to run more than once. It adds missing columns with `if not exists`.
- If goals do not save in `/tracker`, run `supabase-tracker-goals.sql` again.
- If uploaded question media fails, check the `question-media` Storage bucket and run `supabase-question-media-columns.sql`.
