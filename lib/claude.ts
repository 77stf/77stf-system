import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseAdminClient } from './supabase'
import { AI_MODELS, APPROX_COST_PER_1K } from './ai-config'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// Centralized Claude call with automatic error logging + usage tracking slot
export async function callClaude(params: {
  feature: string
  model: string
  system: string
  messages: Anthropic.Messages.MessageParam[]
  max_tokens?: number
  client_id?: string
  project_id?: string
  audit_id?: string
  triggered_by?: 'user' | 'guardian' | 'webhook' | 'cron'
  metadata?: Record<string, unknown>
}): Promise<{ text: string; usage: { input: number; output: number }; stop_reason: string }> {
  const { feature, model, system, messages, max_tokens = 2048, client_id, project_id, audit_id, triggered_by = 'user', metadata } = params

  const startedAt = Date.now()

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens,
      system,
      messages,
    })

    const responseTimeMs = Date.now() - startedAt
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const stopReason = response.stop_reason ?? 'end_turn'
    const cacheReadTokens = (response.usage as unknown as Record<string, number>).cache_read_input_tokens ?? 0
    const usage = {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    }

    // Usage tracking — logs every Claude call to ai_usage_log (Etap 5b)
    const outputRate = APPROX_COST_PER_1K[model as keyof typeof APPROX_COST_PER_1K] ?? 0.015
    // cache_read_tokens cost ~3% of regular input tokens (Anthropic pricing)
    const costUsd =
      ((usage.input / 1000) * (outputRate * 0.2)) +
      ((usage.output / 1000) * outputRate) +
      ((cacheReadTokens / 1000) * (outputRate * 0.006))
    const admin = createSupabaseAdminClient()
    // Fire-and-forget: tries full insert (requires migration 005), falls back to base columns
    void (async () => {
      const fullPayload = {
        feature, model,
        input_tokens: usage.input,
        output_tokens: usage.output,
        cost_usd: costUsd,
        client_id: client_id ?? null,
        project_id: project_id ?? null,
        audit_id: audit_id ?? null,
        stop_reason: stopReason,
        response_time_ms: responseTimeMs,
        cache_read_tokens: cacheReadTokens,
        triggered_by,
        metadata: metadata ?? null,
      }
      const { error } = await admin.from('ai_usage_log').insert(fullPayload)
      if (!error) return
      // Fallback: base columns only (migration 004 — always present)
      try {
        await admin.from('ai_usage_log').insert({
          feature, model,
          input_tokens: usage.input,
          output_tokens: usage.output,
          cost_usd: costUsd,
          client_id: client_id ?? null,
        })
      } catch { /* suppress — never block caller */ }
    })()

    return { text, usage, stop_reason: stopReason }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // Log every AI error to error_log for observability
    try {
      const admin = createSupabaseAdminClient()
      await admin.from('error_log').insert({
        source: `claude/${feature}`,
        message,
        metadata: { model, client_id, feature },
      })
    } catch {
      // Suppress secondary error — don't let logging break the caller
    }

    throw error
  }
}

export interface MeetingAnalysis {
  summary: string
  decisions: string[]
  promises_us: { text: string; deadline?: string }[]
  promises_client: { text: string; deadline?: string }[]
  pain_points: string[]
  red_flags: string[]
  tasks: { text: string; assignee: string; deadline?: string }[]
}

// Wire to Fireflies webhook when implemented (Etap ?)
export async function analyzeMeeting(transcript: string, client_id?: string): Promise<MeetingAnalysis> {
  const { text } = await callClaude({
    feature: 'meetingAnalysis',
    model: AI_MODELS.fast,
    system: 'Jesteś asystentem który analizuje transkrypty spotkań biznesowych. Odpowiadaj WYŁĄCZNIE w JSON bez żadnego dodatkowego tekstu.',
    messages: [
      {
        role: 'user',
        content: `Przeanalizuj transkrypt spotkania. Zwróć TYLKO JSON bez markdown, bez backticks, bez żadnego tekstu przed lub po. Format: {summary, decisions, promises_us, promises_client, pain_points, red_flags, tasks}\n\nTranskrypt:\n${transcript}`,
      },
    ],
    max_tokens: 2048,
    client_id,
  })

  try {
    return JSON.parse(text)
  } catch {
    return {
      summary: 'Błąd analizy — sprawdź transkrypt ręcznie',
      decisions: [],
      promises_us: [],
      promises_client: [],
      pain_points: [],
      red_flags: [],
      tasks: [],
    }
  }
}
