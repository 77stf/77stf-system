import { NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'
import { callClaude } from '@/lib/claude'
import { AI_MODELS } from '@/lib/ai-config'
import { rateLimit } from '@/lib/rate-limit'

// ─── GET /api/intelligence/tech-monitor ──────────────────────────────────────
// Returns aggregated watchlist of tools from stack_items (live + in_progress)
// Grouped by tool name with client count

export async function GET() {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const supabase = createSupabaseAdminClient()

  const { data: items, error } = await supabase
    .from('stack_items')
    .select('id, name, category, status, description, client_id, metadata')
    .in('status', ['live', 'in_progress'])
    .order('name')

  if (error) {
    void supabase.from('error_log').insert({ source: 'api/intelligence/tech-monitor GET', message: error.message })
    return NextResponse.json({ error: 'Błąd pobierania danych' }, { status: 500 })
  }

  // Aggregate by name
  const toolMap = new Map<string, {
    name: string
    category: string
    status: string
    description: string
    client_ids: string[]
    metadata: Record<string, unknown>
  }>()

  for (const item of (items ?? [])) {
    const key = item.name.toLowerCase()
    if (toolMap.has(key)) {
      toolMap.get(key)!.client_ids.push(item.client_id)
    } else {
      toolMap.set(key, {
        name: item.name,
        category: item.category,
        status: item.status,
        description: item.description ?? '',
        client_ids: [item.client_id],
        metadata: (item.metadata as Record<string, unknown>) ?? {},
      })
    }
  }

  const tools = Array.from(toolMap.values()).map(t => ({
    ...t,
    client_count: new Set(t.client_ids).size,
  }))

  return NextResponse.json({ tools })
}

// ─── POST /api/intelligence/tech-monitor ─────────────────────────────────────
// Body: { tool_name, description?, category?, check_all?: boolean, tools?: ToolCheckInput[] }
// Uses Haiku to check for updates on a single tool (or batch if check_all)

interface ToolCheckInput {
  name: string
  description?: string
  category?: string
}

interface UpdateCheckResult {
  tool_name: string
  has_update: boolean
  update_title?: string
  update_summary?: string
  recommendation?: string
  severity?: 'major' | 'minor' | 'patch'
  version_info?: string
  checked_at: string
}

export async function POST(req: Request) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const allowed = rateLimit(`tech-monitor:${user.id}`, 10, 60_000)
  if (!allowed) return NextResponse.json({ error: 'Za dużo zapytań. Zaczekaj chwilę.' }, { status: 429 })

  const supabase = createSupabaseAdminClient()
  const body = await req.json() as { tool_name?: string; description?: string; category?: string; tools?: ToolCheckInput[] }

  // Determine tools to check
  const toolsToCheck: ToolCheckInput[] = body.tools?.length
    ? body.tools
    : [{ name: body.tool_name ?? '', description: body.description, category: body.category }]

  if (!toolsToCheck[0]?.name) {
    return NextResponse.json({ error: 'Podaj nazwę narzędzia' }, { status: 400 })
  }

  // Build prompt
  const toolsList = toolsToCheck.map(t =>
    `- ${t.name}${t.description ? ` (${t.description})` : ''}${t.category ? ` [kategoria: ${t.category}]` : ''}`
  ).join('\n')

  const system = `Jesteś ekspertem od monitorowania aktualizacji narzędzi SaaS i AI.
Sprawdzasz czy wymienione narzędzia miały istotne aktualizacje, nowe wersje lub znaczące zmiany do kwietnia 2026.
Odpowiadasz TYLKO w formacie JSON — bez żadnego tekstu poza JSON.
Dla każdego narzędzia podaj:
- has_update: true/false — czy jest znana istotna aktualizacja
- update_title: krótki tytuł (max 60 znaków), np. "Vapi v2.0 — 40% taniej za minutę"
- update_summary: opis zmian (max 150 znaków)
- recommendation: co zrobić (max 100 znaków)
- severity: "major" (nowe API/breaking) | "minor" (nowe funkcje) | "patch" (poprawki)
- version_info: np. "v2.0.1 (marzec 2026)"
Jeśli narzędzie jest nieznane lub nie masz info o aktualizacji, ustaw has_update: false.`

  const userMsg = `Sprawdź aktualizacje dla następujących narzędzi (stan na kwiecień 2026):
${toolsList}

Odpowiedz w formacie JSON:
{
  "results": [
    {
      "tool_name": "...",
      "has_update": true/false,
      "update_title": "...",
      "update_summary": "...",
      "recommendation": "...",
      "severity": "major|minor|patch",
      "version_info": "..."
    }
  ]
}`

  try {
    const { text } = await callClaude({
      feature: 'tech-monitor',
      model: AI_MODELS.fast,
      system,
      messages: [{ role: 'user', content: userMsg }],
      max_tokens: 1200,
      triggered_by: 'user',
    })

    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] ?? text
    const parsed = JSON.parse(jsonStr) as { results: UpdateCheckResult[] }
    const results: UpdateCheckResult[] = (parsed.results ?? []).map(r => ({
      ...r,
      checked_at: new Date().toISOString(),
    }))

    // Auto-add major updates to offline_ideas if table exists
    const majorUpdates = results.filter(r => r.has_update && r.severity === 'major')
    if (majorUpdates.length > 0) {
      for (const upd of majorUpdates) {
        try {
          await supabase.from('offline_ideas').insert({
            title: `Upgrade: ${upd.update_title ?? upd.tool_name}`,
            category: 'system_upgrade',
            description: `${upd.update_summary ?? ''}\n\nRekomendacja: ${upd.recommendation ?? ''}`,
            priority: 'high',
            status: 'new',
            source_agent: 'tech_monitor',
          })
        } catch { /* table might not exist yet */ }
      }
    }

    return NextResponse.json({ results })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    void supabase.from('error_log').insert({ source: 'api/intelligence/tech-monitor POST', message: msg })
    return NextResponse.json({ error: 'Błąd sprawdzania aktualizacji' }, { status: 500 })
  }
}
