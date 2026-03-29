Generate a Supabase SQL migration for a new table.

Given the table name and columns in $ARGUMENTS:
1. Generate CREATE TABLE SQL with:
   - `id uuid primary key default gen_random_uuid()`
   - `created_at timestamptz default now()`
   - Row Level Security: `alter table X enable row level security`
   - Appropriate RLS policies based on table purpose
2. Generate TypeScript interface matching the table (add to lib/types.ts)
3. Show the SQL to run in Supabase SQL Editor
4. Do NOT run the SQL automatically — show it for manual execution

Usage: /db-migration user_roles "user_id uuid references auth.users, role text"
