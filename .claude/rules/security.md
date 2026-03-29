# Security Rules for 77STF

## Auth
- NEVER put auth tokens, session IDs, or client IDs in URL parameters
- Portal klienta = Supabase Auth magic link via email (ONLY method)
- Admin panel = Supabase Auth email + password
- All /dashboard/** and /portal/** routes must be protected by middleware.ts

## Data Isolation
- Every Supabase query must respect RLS
- Clients can ONLY see their own data (RLS policy: auth.uid() = client_contacts.user_id)
- Never return data for other clients in portal routes

## API Security
- All API routes must verify user session before processing
- Use createSupabaseAdminClient() only in api/ routes
- Validate all input (Zod or manual validation)
- Never expose SUPABASE_SERVICE_ROLE_KEY to client

## Content Security
- No client secrets, API keys, or passwords in git
- .env.local is gitignored — never commit it
- Validate webhook signatures from n8n
