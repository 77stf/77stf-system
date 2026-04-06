import { createSupabaseAdminClient } from '@/lib/supabase'
import { TelegramMonitor } from './telegram-monitor'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase'

export const metadata = { title: 'Telegram Monitor — 77STF' }
export const revalidate = 0

export default async function TelegramPage() {
  const authClient = await createSupabaseServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  const supabase = createSupabaseAdminClient()
  const today = new Date(); today.setHours(0, 0, 0, 0)

  // Pre-fetch initial data server-side for instant render
  const [messagesRes, statsRes] = await Promise.all([
    supabase
      .from('telegram_messages')
      .select('id, channel_id, channel_name, message_id, sender_name, sender_username, content, media_type, reply_to_id, reply_to_sender, reply_to_text, forwarded_from, ai_score, ai_flag, sent_at')
      .order('sent_at', { ascending: false })
      .limit(80),
    supabase
      .from('telegram_messages')
      .select('channel_id, channel_name, sent_at, ai_score, ai_flag')
      .gte('sent_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  const messages = messagesRes.data ?? []

  // Build stats from query
  const CHANNEL_META: Record<string, { emoji: string; topic_id: number }> = {
    '-1002360946496': { emoji: '👤', topic_id: 7 },
    '-1002202808162': { emoji: '💬', topic_id: 11 },
    '-1003468377891': { emoji: '🤖', topic_id: 12 },
    '-1001895589451': { emoji: '❓', topic_id: 15 },
    '-1001916600905': { emoji: '🔴', topic_id: 2 },
    '-1001953219180': { emoji: '📸', topic_id: 4 },
    '-1001950386772': { emoji: '🎵', topic_id: 6 },
    '-1002016536758': { emoji: '🔗', topic_id: 8 },
    '-1001854651007': { emoji: '🎮', topic_id: 9 },
    '-1001929535484': { emoji: '🐦', topic_id: 5 },
    '-1002492477972': { emoji: '📺', topic_id: 10 },
    '-1001830816436': { emoji: '▶️', topic_id: 14 },
    '-1002003349867': { emoji: '🧵', topic_id: 13 },
  }

  type ChannelStat = {
    channel_id: string
    channel_name: string
    emoji: string
    topic_id: number
    today: number
    week: number
    last_message_at: string | null
    urgent_count: number
    opportunity_count: number
    issue_count: number
  }
  const statsMap: Record<string, ChannelStat> = {}
  for (const msg of (statsRes.data ?? [])) {
    const cid = msg.channel_id
    if (!statsMap[cid]) {
      statsMap[cid] = {
        channel_id: cid,
        channel_name: msg.channel_name,
        emoji: CHANNEL_META[cid]?.emoji ?? '📢',
        topic_id: CHANNEL_META[cid]?.topic_id ?? 0,
        today: 0, week: 0, last_message_at: null,
        urgent_count: 0, opportunity_count: 0, issue_count: 0,
      }
    }
    const s = statsMap[cid]
    s.week++
    if (new Date(msg.sent_at) >= today) s.today++
    if (!s.last_message_at || msg.sent_at > s.last_message_at) s.last_message_at = msg.sent_at
    if (msg.ai_flag === 'urgent') s.urgent_count++
    if (msg.ai_flag === 'opportunity') s.opportunity_count++
    if (msg.ai_flag === 'issue') s.issue_count++
  }

  const channelStats = Object.values(statsMap).sort((a, b) => b.today - a.today)
  const totalToday = channelStats.reduce((s, c) => s + c.today, 0)
  const urgentCount = channelStats.reduce((s, c) => s + c.urgent_count, 0)
  const opportunityCount = channelStats.reduce((s, c) => s + c.opportunity_count, 0)

  return (
    <TelegramMonitor
      initialMessages={messages}
      initialStats={channelStats}
      totalToday={totalToday}
      urgentCount={urgentCount}
      opportunityCount={opportunityCount}
    />
  )
}
