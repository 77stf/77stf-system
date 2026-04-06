import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase'
import { callClaude } from '@/lib/claude'
import { AI_MODELS } from '@/lib/ai-config'

// POST /api/webhooks/telegram
// Called by the telegram-forwarder service (running on Hetzner VPS)
// Stores each message + runs AI importance scoring via Haiku

interface TelegramMessagePayload {
  channel_id: string
  channel_name: string
  message_id: number
  sender_id?: number
  sender_name?: string
  sender_username?: string
  content?: string
  media_type?: string
  media_file_id?: string
  reply_to_id?: number
  reply_to_sender?: string
  reply_to_text?: string
  forwarded_from?: string
  sent_at: string   // ISO string
  raw?: Record<string, unknown>
}

const KNOWN_CHANNELS = new Set([
  '-1002360946496', // MODELS RECRUITMENT
  '-1002202808162', // CHATTING
  '-1003468377891', // AI INTEGRATION
  '-1001895589451', // GENERAL QUESTIONS
  '-1001916600905', // REDDIT (+TRAFFIC)
  '-1001953219180', // INSTAGRAM (+TRAFFIC)
  '-1001950386772', // TIKTOK (+TRAFFIC)
  '-1002016536758', // FETLIFE (+TRAFFIC)
  '-1001854651007', // GG'S (+TRAFFIC)
  '-1001929535484', // TWITTER (+TRAFFIC)
  '-1002492477972', // OFTV (+TRAFFIC)
  '-1001830816436', // YOUTUBE (+TRAFFIC)
  '-1002003349867', // THREADS (+TRAFFIC)
])

export async function POST(req: Request) {
  // Verify shared secret from forwarder service
  const secret = req.headers.get('x-telegram-webhook-secret')
  if (!secret || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: TelegramMessagePayload
  try {
    payload = await req.json() as TelegramMessagePayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { channel_id, channel_name, message_id, sent_at } = payload

  if (!channel_id || !channel_name || !message_id || !sent_at) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!KNOWN_CHANNELS.has(channel_id)) {
    return NextResponse.json({ error: 'Unknown channel' }, { status: 400 })
  }

  // AI importance scoring — Haiku is cheap and fast enough per-message
  let ai_score: number | null = null
  let ai_flag: string | null = null

  const text = payload.content?.trim()
  if (text && text.length > 15) {
    try {
      const { text: aiResp } = await callClaude({
        feature: 'telegramScore',
        model: AI_MODELS.fast,
        system: `Oceniasz wiadomości z kanałów Telegram agencji zarządzania twórcami treści (OnlyFans/social media).
Odpowiedz TYLKO czysty JSON bez markdown:
{"score": 0-10, "flag": "urgent"|"opportunity"|"issue"|null}

Skala score:
- 8-10: krytyczne (nowy klient, problem wymagający reakcji, duża szansa biznesowa)
- 5-7: warte uwagi (pytanie rekrutacyjne, feedback, zapytanie)
- 0-4: rutynowe (spam, powiadomienia, ogólna rozmowa)

flag:
- "urgent" → wymaga reakcji w ciągu godziny
- "opportunity" → szansa na nowego klienta/współpracę/przychód
- "issue" → problem wymagający rozwiązania
- null → rutynowe`,
        messages: [{ role: 'user', content: `[${channel_name}]: ${text.slice(0, 500)}` }],
        max_tokens: 60,
        triggered_by: 'webhook',
      })
      const clean = aiResp.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(clean) as { score?: number; flag?: string }
      ai_score = typeof parsed.score === 'number' ? Math.min(10, Math.max(0, Math.round(parsed.score))) : null
      ai_flag = parsed.flag ?? null
    } catch { /* AI scoring is best-effort, never block message storage */ }
  }

  const supabase = createSupabaseAdminClient()

  const { error } = await supabase.from('telegram_messages').upsert({
    channel_id,
    channel_name,
    message_id,
    sender_id: payload.sender_id ?? null,
    sender_name: payload.sender_name ?? null,
    sender_username: payload.sender_username ?? null,
    content: text ?? null,
    media_type: payload.media_type ?? null,
    media_file_id: payload.media_file_id ?? null,
    reply_to_id: payload.reply_to_id ?? null,
    reply_to_sender: payload.reply_to_sender ?? null,
    reply_to_text: payload.reply_to_text ?? null,
    forwarded_from: payload.forwarded_from ?? null,
    ai_score,
    ai_flag,
    sent_at,
    raw: payload.raw ?? {},
  }, { onConflict: 'channel_id,message_id', ignoreDuplicates: true })

  if (error) {
    await supabase.from('error_log').insert({
      source: 'api/webhooks/telegram',
      message: error.message,
      metadata: { channel_id, message_id },
    })
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ai_score, ai_flag })
}
