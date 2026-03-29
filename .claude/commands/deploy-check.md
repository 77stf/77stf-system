Pre-deployment verification checklist.

1. Run `npm run build` — must be clean (0 errors)
2. Run `npm run lint` if configured
3. Check .env.local exists and has required vars:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - ANTHROPIC_API_KEY
4. Check no console.log left in production code
5. Check no hardcoded test data (fake clients, mock emails)
6. Verify middleware.ts exists and protects /dashboard and /portal
7. Report: ✓ ready for deploy or list blockers

Usage: /deploy-check
