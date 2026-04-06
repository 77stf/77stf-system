import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/clients/[id]/notes — fetch all notes for a client
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const { id } = await params
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('client_notes')
    .select('*')
    .eq('client_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ notes: [], table_missing: true })
    void supabase.from('error_log').insert({ source: 'api/clients/[id]/notes GET', message: error.message })
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }

  return NextResponse.json({ notes: data ?? [] })
}

// POST /api/clients/[id]/notes — create a new note
export async function POST(req: NextRequest, { params }: RouteContext) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const { id } = await params
  const supabase = createSupabaseAdminClient()

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 }) }

  const { content, source, source_url, tags, importance, created_by } = body as {
    content?: string; source?: string; source_url?: string
    tags?: string[]; importance?: string; created_by?: string
  }

  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Treść notatki jest wymagana' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('client_notes')
    .insert({
      client_id: id,
      content: content.trim(),
      source: source ?? 'manual',
      source_url: source_url ?? null,
      tags: tags ?? null,
      importance: importance ?? 'medium',
      created_by: created_by ?? null,
    })
    .select()
    .single()

  if (error) {
    void supabase.from('error_log').insert({ source: 'api/clients/[id]/notes POST', message: error.message })
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }

  return NextResponse.json({ note: data }, { status: 201 })
}

// PATCH /api/clients/[id]/notes — update a note (body: { id, content?, importance? })
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const { id: clientId } = await params
  const supabase = createSupabaseAdminClient()

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 }) }

  const { id: noteId, content, importance } = body as { id?: string; content?: string; importance?: string }

  if (!noteId || typeof noteId !== 'string') {
    return NextResponse.json({ error: 'ID notatki jest wymagane' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (typeof content === 'string' && content.trim()) updates.content = content.trim()
  if (typeof importance === 'string') updates.importance = importance

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Brak danych do aktualizacji' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('client_notes')
    .update(updates)
    .eq('id', noteId)
    .eq('client_id', clientId)
    .select()
    .single()

  if (error) {
    void supabase.from('error_log').insert({ source: 'api/clients/[id]/notes PATCH', message: error.message })
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }

  return NextResponse.json({ note: data })
}

// DELETE /api/clients/[id]/notes?noteId=xxx
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const { id: clientId } = await params
  const { searchParams } = new URL(req.url)
  const noteId = searchParams.get('noteId')

  if (!noteId) return NextResponse.json({ error: 'noteId jest wymagane' }, { status: 400 })

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase
    .from('client_notes')
    .delete()
    .eq('id', noteId)
    .eq('client_id', clientId)

  if (error) {
    void supabase.from('error_log').insert({ source: 'api/clients/[id]/notes DELETE', message: error.message })
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
