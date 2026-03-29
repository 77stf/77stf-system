import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/clients/[id]/notes — fetch all notes for a client
export async function GET(_req: NextRequest, { params }: RouteContext) {
  // Auth check
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createSupabaseAdminClient()

  try {
    const { data, error } = await supabase
      .from('client_notes')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      // Table may not exist yet — return empty gracefully
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ notes: [], table_missing: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ notes: data ?? [] })
  } catch {
    return NextResponse.json({ notes: [], table_missing: true })
  }
}

// POST /api/clients/[id]/notes — create a new note
export async function POST(req: NextRequest, { params }: RouteContext) {
  // Auth check
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createSupabaseAdminClient()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { content, source, source_url, tags, importance, created_by } = body as {
    content?: string
    source?: string
    source_url?: string
    tags?: string[]
    importance?: string
    created_by?: string
  }

  if (!content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  try {
    const { data, error } = await supabase
      .from('client_notes')
      .insert({
        client_id: id,
        content,
        source: source ?? 'manual',
        source_url: source_url ?? null,
        tags: tags ?? null,
        importance: importance ?? 'medium',
        created_by: created_by ?? null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ note: data }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Nieznany błąd'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
