import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'
import { CreateTaskSchema } from '@/lib/validation'

export async function GET(request: NextRequest) {
  // Auth check
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const clientId = searchParams.get('client_id')
  const priority = searchParams.get('priority')

  const adminClient = createSupabaseAdminClient()

  try {
    let query = adminClient
      .from('tasks')
      .select('*, client:clients(id, name)')
      .order('priority', { ascending: false })
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }
    if (clientId) {
      query = query.eq('client_id', clientId)
    }
    if (priority) {
      query = query.eq('priority', priority)
    }

    const { data: tasks, error } = await query

    if (error) {
      // Table does not exist
      if (error.code === '42P01') {
        return NextResponse.json({ tasks: [], table_missing: true })
      }
      throw error
    }

    return NextResponse.json({ tasks })
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string }

    if (error?.code === '42P01') {
      return NextResponse.json({ tasks: [], table_missing: true })
    }

    await adminClient.from('error_log').insert({
      source: 'api/tasks GET',
      message: error?.message ?? 'Unknown error',
      metadata: { status, client_id: clientId, priority },
    })

    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Auth check
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
  }

  const adminClient = createSupabaseAdminClient()

  let rawBody: unknown
  try { rawBody = await request.json() }
  catch { return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 }) }

  const parsed = CreateTaskSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Nieprawidłowe dane', details: parsed.error.issues }, { status: 400 })
  }
  const body = parsed.data

  try {
    const { data: task, error } = await adminClient
      .from('tasks')
      .insert({
        title: body.title.trim(),
        client_id: body.client_id ?? null,
        description: body.description ?? null,
        status: body.status ?? 'todo',
        priority: body.priority ?? 'medium',
        due_date: body.due_date ?? null,
      })
      .select('*, client:clients(id, name)')
      .single()

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ error: 'Tabela zadań nie istnieje' }, { status: 503 })
      }
      throw error
    }

    return NextResponse.json({ task }, { status: 201 })
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string }

    if (error?.code === '42P01') {
      return NextResponse.json({ error: 'Tabela zadań nie istnieje' }, { status: 503 })
    }

    await adminClient.from('error_log').insert({
      source: 'api/tasks POST',
      message: error?.message ?? 'Unknown error',
      metadata: { title: body.title, client_id: body.client_id },
    })

    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 })
  }
}
