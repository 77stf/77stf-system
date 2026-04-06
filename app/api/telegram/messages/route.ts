import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { createSupabaseAdminClient } from '@/lib/supabase'

// GET /api/telegram/messages
// Query params:
//   channel_id   — filter by specific channel
//   flag         — filter by ai_flag: urgent | opportunity | issue
//   limit        — max messages (default 60, max 200)
//   since        — ISO datetime, messages after this time
//   stats=1      — return per-channel stats instead of messages

const CHANNEL_META: Record<string, { name: string; emoji: string; topic_id: number }> = {
  '-1002360946496': { name: 'MODELS RECRUITMENT', emoji: '👤', topic_id: 7 },
  '-1002202808162': { name: 'CHATTING',            emoji: '💬', topic_id: 11 },
  '-1003468377891': { name: 'AI INTEGRATION',      emoji: '🤖', topic_id: 12 },
  '-1001895589451': { name: 'GENERAL QUESTIONS',   emoji: '❓', topic_id: 15 },
  '-1001916600905': { name: 'REDDIT (+TRAFFIC)',    emoji: '🔴', topic_id: 2 },
  '-1001953219180': { name: 'INSTAGRAM (+TRAFFIC)', emoji: '📸', topic_id: 4 },
  '-1001950386772': { name: 'TIKTOK (+TRAFFIC)',    emoji: '🎵', topic_id: 6 },
  '-1002016536758': { name: 'FETLIFE (+TRAFFIC)',   emoji: '🔗', topic_id: 8 },
  '-1001854651007': { name: "GG'S (+TRAFFIC)",      emoji: '🎮', topic_id: 9 },
  '-1001929535484': { name: 'TWITTER (+TRAFFIC)',   emoji: '🐦', topic_id: 5 },
  '-1002492477972': { name: 'OFTV (+TRAFFIC)',      emoji: '📺', topic_id: 10 },
  '-1001830816436': { name: 'YOUTUBE (+TRAFFIC)',   emoji: '▶️', topic_id: 14 },
  '-1002003349867': { name: 'THREADS (+TRAFFIC)',   emoji: '🧵', topic_id: 13 },
}

export async function GET(req: Request) {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const channelId = searchParams.get('channel_id')
  const flag = searchParams.get('flag')
  const limit = Math.min(200, parseInt(searchParams.get('limit') ?? '60'))
  const since = searchParams.get('since')
  const statsOnly = searchParams.get('stats') === '1'

  const supabase = createSupabaseAdminClient()

  if (statsOnly) {
    // Per-channel stats: count today, count total, last message time, last ai_flag
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('telegram_messages')
      .select('channel_id, channel_name, sent_at, ai_score, ai_flag')
      .gte('sent_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // last 7 days

    if (error) return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })

    const stats: Record<string, {
      channel_id: string
      channel_name: string
      emoji: string
      topic_id: number
      today: number
      week: number
      last_message_at: string | null
      urgent_count: number
      opportunity_count: number
    }> = {}

    for (const msg of (data ?? [])) {
      const cid = msg.channel_id
      if (!stats[cid]) {
        const meta = CHANNEL_META[cid]
        stats[cid] = {
          channel_id: cid,
          channel_name: msg.channel_name,
          emoji: meta?.emoji ?? '📢',
          topic_id: meta?.topic_id ?? 0,
          today: 0,
          week: 0,
          last_message_at: null,
          urgent_count: 0,
          opportunity_count: 0,
        }
      }
      const s = stats[cid]
      s.week++
      if (new Date(msg.sent_at) >= today) s.today++
      if (!s.last_message_at || msg.sent_at > s.last_message_at) s.last_message_at = msg.sent_at
      if (msg.ai_flag === 'urgent') s.urgent_count++
      if (msg.ai_flag === 'opportunity') s.opportunity_count++
    }

    return NextResponse.json({
      stats: Object.values(stats).sort((a, b) => b.today - a.today),
      channel_meta: CHANNEL_META,
    })
  }

  // Message feed
  let query = supabase
    .from('telegram_messages')
    .select('id, channel_id, channel_name, message_id, sender_name, sender_username, content, media_type, reply_to_id, reply_to_sender, reply_to_text, forwarded_from, ai_score, ai_flag, sent_at')
    .order('sent_at', { ascending: false })
    .limit(limit)

  if (channelId) query = query.eq('channel_id', channelId)
  if (flag) query = query.eq('ai_flag', flag)
  if (since) query = query.gt('sent_at', since)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })

  return NextResponse.json({
    messages: data ?? [],
    channel_meta: CHANNEL_META,
  })
}
