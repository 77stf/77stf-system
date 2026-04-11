import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'
import { callClaude } from '@/lib/claude'
import { AI_MODELS } from '@/lib/ai-config'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  if (!rateLimit(`pres-gen:${user.id}`, 10, 60 * 1000)) {
    return NextResponse.json({ error: 'Za dużo zapytań' }, { status: 429 })
  }

  const { id } = await params
  const admin = createSupabaseAdminClient()

  // Load presentation + client context
  const { data: pres } = await admin
    .from('presentations')
    .select('*, clients(id, name, industry, owner_name, notes)')
    .eq('id', id)
    .single()

  if (!pres) return NextResponse.json({ error: 'Nie znaleziono prezentacji' }, { status: 404 })

  // Load additional context: audits, notes, roadmap activities
  const clientId = pres.client_id
  const [{ data: audits }, { data: notes }, { data: activities }] = await Promise.all([
    admin.from('audits').select('title, status, score, ai_summary, findings').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1),
    admin.from('client_notes').select('content, importance').eq('client_id', clientId).order('created_at', { ascending: false }).limit(5),
    admin.from('roadmap_activities').select('activity_type, title, description').eq('client_id', clientId).order('created_at', { ascending: false }).limit(10),
  ])

  const client = pres.clients as { name: string; industry?: string; owner_name?: string } | null
  const audit = audits?.[0]

  const prompt = `Jesteś ekspertem ds. sprzedaży i prezentacji B2B dla polskich MŚP. Firma 77STF oferuje: automatyzacje AI, voice agents, chatboty RAG, social media automation.

## Klient
Nazwa: ${client?.name ?? 'Nieznany'}
Branża: ${client?.industry ?? 'Nieznana'}
Kontakt: ${client?.owner_name ?? 'Nieznany'}

## Dane z audytu
${audit ? `Ocena: ${audit.score ?? 'brak'}/100\nPodsumowanie: ${audit.ai_summary ?? 'brak'}\nPriorytety: ${JSON.stringify(audit.findings?.slice(0, 3) ?? [])}` : 'Brak audytu — użyj ogólnej wiedzy o branży.'}

## Ostatnie notatki
${(notes ?? []).map(n => `- ${n.content}`).join('\n') || 'Brak notatek'}

## Historia aktywności
${(activities ?? []).map(a => `- ${a.activity_type}: ${a.title}`).join('\n') || 'Brak aktywności'}

Wygeneruj plan prezentacji demo dla tego klienta. Odpowiedz TYLKO w JSON:
{
  "slides": [
    {
      "order": 1,
      "title": "tytuł slajdu",
      "talking_points": ["punkt 1", "punkt 2", "punkt 3"],
      "key_message": "główne przesłanie tego slajdu w 1 zdaniu",
      "potential_objection": "potencjalna obiekcja klienta",
      "canva_prompt": "opis co powinno być na slajdzie w Canva"
    }
  ],
  "opening_hook": "mocne zdanie otwierające prezentację",
  "closing_cta": "konkretne wezwanie do działania na końcu"
}

Wygeneruj 6-8 slajdów. Slajdy muszą być konkretne dla tej branży i klienta.`

  try {
    const result = await callClaude({
      feature: 'presentationGenerate',
      model: AI_MODELS.balanced,
      system: 'Jesteś ekspertem ds. sprzedaży i prezentacji B2B. Odpowiadasz wyłącznie w JSON.',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      client_id: clientId,
    })

    // Extract JSON from response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Błąd generowania — spróbuj ponownie' }, { status: 500 })

    const generated = JSON.parse(jsonMatch[0]) as {
      slides: Record<string, unknown>[]
      opening_hook: string
      closing_cta: string
    }

    // Save slides to presentation
    await admin.from('presentations').update({ slides_data: generated.slides }).eq('id', id)

    return NextResponse.json({ data: generated })
  } catch {
    return NextResponse.json({ error: 'Błąd AI — spróbuj ponownie' }, { status: 500 })
  }
}
