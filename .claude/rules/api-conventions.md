# API Route Conventions

## Response Format
All API routes return JSON:
```typescript
// Success
return NextResponse.json({ data: result }, { status: 200 })
// Error
return NextResponse.json({ error: 'Message in Polish for UI' }, { status: 400 })
// Unauthorized
return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
```

## Auth Check (required in every protected route)
```typescript
const supabase = createSupabaseAdminClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
```

## Error Handling
Wrap all logic in try/catch and log to error_log table.

## Webhook Routes (n8n)
- Validate webhook secret header: `x-webhook-secret`
- Store secret in env: `N8N_WEBHOOK_SECRET`
- Return 200 immediately, process async if heavy
