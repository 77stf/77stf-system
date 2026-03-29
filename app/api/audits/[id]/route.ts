import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'

interface RouteContext { params: Promise<{ id: string }> }

// GET /api/audits/[id]
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('audits')
    .select('*, client:clients(id, name, industry, status)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ audit: data })
}

// PATCH /api/audits/[id] — autosave answers or update status
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const allowed = ['answers', 'status', 'title', 'score', 'findings', 'recommendations',
    'ai_summary', 'ai_brief', 'quote_id', 'completed_at']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: 'Brak pól do aktualizacji' }, { status: 400 })

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('audits')
    .update(update)
    .eq('id', id)
    .select('*, client:clients(id, name, industry, status)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ audit: data })
}

// DELETE /api/audits/[id]
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from('audits').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
