# Supabase migrations

The versioned files in `supabase/migrations/` are the authoritative database
history. Apply them in timestamp order with the Supabase CLI. Do not re-run the
root-level `supabase-*.sql` files against an existing project: they are retained
only as historical feature snapshots and can contain policies superseded by a
newer migration.

Before production changes:

1. Create a database backup.
2. Review the pending migration.
3. Run the Supabase security and performance advisors.
4. Apply the migration together with the matching application deployment.
5. Verify anonymous, member and non-member access separately.
