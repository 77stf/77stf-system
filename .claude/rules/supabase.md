# Supabase Usage Rules

## Client Selection (CRITICAL)
- `createSupabaseServerClient()` — use in: Server Components, Route Handlers (user-scoped queries)
- `createSupabaseAdminClient()` — use in: `app/api/` routes ONLY (bypasses RLS)
- NEVER use browser Supabase client in server-side code
- NEVER use admin client outside of `app/api/`

## Auth Rules
- Portal klienta: Supabase Auth magic link ONLY
- NEVER put session tokens or client tokens in URLs
- Always check session in API routes: `const { data: { user } } = await supabase.auth.getUser()`
- Return 401 if no user in protected routes

## RLS Policy Pattern
Every new table must have:
```sql
alter table table_name enable row level security;
-- Add policies based on access pattern
```

## Error Logging
Always log errors to `error_log` table in API routes:
```typescript
await adminClient.from('error_log').insert({
  source: 'api/route-name',
  message: error.message,
  metadata: { ... context }
})
```

## Type Safety
- Always use types from `lib/types.ts`
- When adding a table, add its TypeScript interface to `lib/types.ts`
