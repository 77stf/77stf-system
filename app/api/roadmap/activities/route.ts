import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase'
import { z } from 'zod'

const schema = z.object({
  client_id: z.string().uuid(),
  stage_key: z.enum(['discovery', 'audit', 'proposal', 'negotiation', 'onboarding', 'active', 'partner'] as const),
  activity_type: z.enum(['call', 'email', 'meeting', 'note', 'quote_sent', 'research', 'demo', 'document', 'whatsapp', 'stage_change'] as const),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  outcome: z.string().optional(),
  contact_person: z.string().optional(),
  scheduled_at: z.string().optional(),
  completed_at: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(req: NextRequest) {
  const admin = createSupabaseAdminClient()
  const { data: { user } } = await admin.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Nieprawidłowe dane', details: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await admin.from('roadmap_activities').insert(parsed.data).select().single()
  if (error) return NextResponse.json({ error: 'Błąd zapisu aktywności' }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const admin = createSupabaseAdminClient()
  const { data: { user } } = await admin.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const clientId = req.nextUrl.searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'Brak client_id' }, { status: 400 })

  const { data, error } = await admin
    .from('roadmap_activities')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: 'Błąd pobierania aktywności' }, { status: 500 })

  return NextResponse.json({ data })
}
