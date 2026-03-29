Scaffold a new dashboard page following 77STF Carbon Pro design system.

Given the page path in $ARGUMENTS:
1. Read lib/tokens.ts to understand current token system
2. Read an existing page (e.g. app/dashboard/page.tsx) for pattern reference
3. Create:
   - `app/dashboard/$ARGUMENTS/page.tsx` — Server Component with Supabase data fetch
   - `app/dashboard/$ARGUMENTS/loading.tsx` — Skeleton shimmer matching page layout
4. Follow Carbon Pro rules:
   - Use `t.` tokens from lib/tokens.ts (import { t } from '@/lib/tokens')
   - Polish UI text
   - English variable names
   - Cards: `style={{ background: t.card.bg, border: `1px solid ${t.card.border}` }}`
5. Add the route to sidebar NAV_ITEMS in app/dashboard/components/sidebar.tsx

Usage: /new-page intelligence
