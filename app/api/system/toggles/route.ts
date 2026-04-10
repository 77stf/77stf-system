import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase'

// n8n workflow ID map — key → n8n workflow ID (canonical, latest active ones)
const N8N_WORKFLOW_IDS: Record<string, string> = {
  n8n_guardian_cron:   '3sxJZEfC3U9BWEZu',
  n8n_radar_cron:      '2B5cItVoK72AgpjQ',
  n8n_slack_crm:       'C8eiEvfWZ835vCOj',
  n8n_quote_followup:  'ohg9faeSXiNf4Jiu',
  n8n_morning_digest:  '9LoQbpuGrZ0nDI4v',
}

async function setN8nWorkflow(workflowId: string, active: boolean) {
  const apiKey = process.env.N8N_API_KEY
  if (!apiKey) return

  await fetch(`https://n8n.socmid.cloud/api/v1/workflows/${workflowId}/${active ? 'activate' : 'deactivate'}`, {
    method: 'POST',
    headers: { 'X-N8N-API-KEY': apiKey },
  })
}

export async function GET() {
  try {
    const admin = createSupabaseAdminClient()
    const { data, error } = await admin
      .from('system_toggles')
      .select('*')
      .order('category')
      .order('key')

    if (error) throw error
    return NextResponse.json({ toggles: data })
  } catch (e: unknown) {
    return NextResponse.json({ error: 'Błąd pobierania toggles' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = createSupabaseAdminClient()
    const { data: { user } } = await admin.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

    const { key, enabled } = await req.json() as { key: string; enabled: boolean }
    if (!key || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Wymagane: key, enabled' }, { status: 400 })
    }

    // Update DB
    const { error } = await admin
      .from('system_toggles')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('key', key)

    if (error) throw error

    // Sync n8n if applicable
    const n8nId = N8N_WORKFLOW_IDS[key]
    if (n8nId) {
      await setN8nWorkflow(n8nId, enabled)
    }

    // Log
    await admin.from('error_log').insert({
      source: 'api/system/toggles',
      message: `Toggle ${key} → ${enabled ? 'ON' : 'OFF'} by ${user.email}`,
      metadata: { key, enabled, user_email: user.email },
    })

    return NextResponse.json({ ok: true, key, enabled })
  } catch (e: unknown) {
    return NextResponse.json({ error: 'Błąd aktualizacji' }, { status: 500 })
  }
}
