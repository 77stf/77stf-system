Scaffold a new API route with auth check and error logging.

Given the route path in $ARGUMENTS:
1. Read lib/supabase.ts for client patterns
2. Create `app/api/$ARGUMENTS/route.ts` with:
   - Import createSupabaseAdminClient (for admin operations) or createSupabaseServerClient (for user-scoped)
   - Auth check at top: verify session, return 401 if missing
   - Try/catch with error logging to `error_log` table
   - Typed request/response
3. Follow convention: GET for reads, POST for mutations, all return NextResponse.json()

Usage: /new-api-route leadgen/run
