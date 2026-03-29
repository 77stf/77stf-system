Review changed code before committing.

1. Run `git diff --staged` to see staged changes
2. Run `npm run build` to verify no TypeScript errors
3. Check for:
   - Hardcoded colors (should use t. tokens from lib/tokens.ts)
   - Polish UI text in components
   - English variable/function names
   - Missing error handling in API routes
   - Token in URL (NEVER — use Supabase Auth magic link)
   - createSupabaseAdminClient used in non-API-route files (forbidden)
4. Report: ✓ clean or list specific issues with file:line references

Usage: /review
