# 77STF Code Style Rules

## Design System — Carbon Pro
- ALWAYS import tokens: `import { t } from '@/lib/tokens'`
- ALWAYS import formatters: `import { formatPLN, formatDate, relativeTime } from '@/lib/format'`
- Use `t.` for ALL colors, spacing, typography values — NEVER hardcode hex colors
- Exception: semantic data states (green for success, red for error) are allowed inline
- Gold (#C49A2E) = ONLY for: 77STF logo, Revenue KPI, main CTA button. NOWHERE else.

## Language Rules
- UI text visible to users: POLISH
- Variable names, function names, comments: ENGLISH
- Database column names: ENGLISH (snake_case)
- File names: ENGLISH (kebab-case)

## Component Patterns
- Cards: `style={{ background: t.card.bg, border: \`1px solid ${t.card.border}\` }}`
- Active states: use `t.violet` or `t.blue` (per current theme)
- Hover effects: CSS class or framer-motion `whileHover`

## File Organization
- `app/dashboard/` — admin/employee views (protected by middleware)
- `app/portal/` — client views (protected by middleware, magic link auth)
- `app/api/` — API routes with auth check
- `components/ui/` — reusable ReactBits components
- `components/dashboard/` — dashboard-specific components
- `lib/` — utilities, Supabase clients, Claude wrapper, types
