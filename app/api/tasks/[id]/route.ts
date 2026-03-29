import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  // Auth check
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
  }

  const { id } = await params
  const adminClient = createSupabaseAdminClient()

  let body: {
    title?: string
    description?: string
    status?: string
    priority?: string
    due_date?: string
    done_at?: string | null
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format danych' }, { status: 400 })
  }

  try {
    // Fetch current task to determine status transition logic
    const { data: current, error: fetchError } = await adminClient
      .from('tasks')
      .select('status, done_at')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === '42P01') {
        return NextResponse.json({ error: 'Tabela zadań nie istnieje' }, { status: 503 })
      }
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Zadanie nie istnieje' }, { status: 404 })
      }
      throw fetchError
    }

    // Build the update payload
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.title !== undefined) updates.title = body.title
    if (body.description !== undefined) updates.description = body.description
    if (body.priority !== undefined) updates.priority = body.priority
    if (body.due_date !== undefined) updates.due_date = body.due_date

    if (body.status !== undefined) {
      updates.status = body.status

      const wasNotDone = current.status !== 'done'
      const isBecomingDone = body.status === 'done'
      const isLeavingDone = current.status === 'done' && body.status !== 'done'

      if (isBecomingDone && wasNotDone) {
        // Transition into done: set done_at if not explicitly provided
        updates.done_at = body.done_at !== undefined ? body.done_at : new Date().toISOString()
      } else if (isLeavingDone) {
        // Transition out of done: clear done_at
        updates.done_at = null
      } else if (body.done_at !== undefined) {
        // Same status but caller explicitly set done_at
        updates.done_at = body.done_at
      }
    } else if (body.done_at !== undefined) {
      // No status change but done_at explicitly provided
      updates.done_at = body.done_at
    }

    const { data: task, error: updateError } = await adminClient
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select('*, client:clients(id, name)')
      .single()

    if (updateError) {
      if (updateError.code === '42P01') {
        return NextResponse.json({ error: 'Tabela zadań nie istnieje' }, { status: 503 })
      }
      if (updateError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Zadanie nie istnieje' }, { status: 404 })
      }
      throw updateError
    }

    return NextResponse.json({ task })
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string }

    if (error?.code === '42P01') {
      return NextResponse.json({ error: 'Tabela zadań nie istnieje' }, { status: 503 })
    }

    await adminClient.from('error_log').insert({
      source: 'api/tasks/[id] PATCH',
      message: error?.message ?? 'Unknown error',
      metadata: { id, ...body },
    })

    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  // Auth check
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
  }

  const { id } = await params
  const adminClient = createSupabaseAdminClient()

  try {
    const { error } = await adminClient
      .from('tasks')
      .delete()
      .eq('id', id)

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ error: 'Tabela zadań nie istnieje' }, { status: 503 })
      }
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Zadanie nie istnieje' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string }

    if (error?.code === '42P01') {
      return NextResponse.json({ error: 'Tabela zadań nie istnieje' }, { status: 503 })
    }

    await adminClient.from('error_log').insert({
      source: 'api/tasks/[id] DELETE',
      message: error?.message ?? 'Unknown error',
      metadata: { id },
    })

    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 })
  }
}
