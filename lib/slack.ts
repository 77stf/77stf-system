import crypto from 'crypto'

// ─── Slack channel routing ────────────────────────────────────────────────────
// Each webhook targets a specific channel for clean separation of concerns

type SlackChannel = 'alerts' | 'brief' | 'media' | 'crm'

const WEBHOOK_MAP: Record<SlackChannel, string> = {
  alerts: 'SLACK_WEBHOOK_ALERTS',   // #alerty-owner — owner only, critical alerts
  brief:  'SLACK_WEBHOOK_BRIEF',    // #daily-brief  — owner only, morning digest
  media:  'SLACK_WEBHOOK_MEDIA',    // #media-monitoring — team, Telegram activity
  crm:    'SLACK_WEBHOOK_CRM',      // #crm-log — team, CRM actions log
}

export async function sendSlackMessage(
  text: string,
  channel: SlackChannel = 'alerts',
): Promise<boolean> {
  const envKey = WEBHOOK_MAP[channel]
  const webhookUrl = process.env[envKey] ?? process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return false

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function sendSlackBlocks(
  blocks: unknown[],
  channel: SlackChannel = 'alerts',
): Promise<boolean> {
  const envKey = WEBHOOK_MAP[channel]
  const webhookUrl = process.env[envKey] ?? process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return false

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ─── Slack signature verification ────────────────────────────────────────────
// Prevents fake webhook calls — Slack signs every request

export function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string,
): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET
  if (!signingSecret) return false

  // Reject requests older than 5 minutes
  const reqTime = parseInt(timestamp, 10)
  if (Math.abs(Date.now() / 1000 - reqTime) > 300) return false

  const baseString = `v0:${timestamp}:${body}`
  const expected = 'v0=' + crypto
    .createHmac('sha256', signingSecret)
    .update(baseString)
    .digest('hex')

  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

// ─── Post to Slack response_url (slash command async reply) ──────────────────

export async function postToSlack(responseUrl: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch { /* best-effort */ }
}

// ─── Slack Block Kit helpers ──────────────────────────────────────────────────

export function buildConfirmationBlock(summary: string, results: string[]) {
  return {
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `✅ *${summary}*` },
      },
      ...(results.length > 0 ? [{
        type: 'section',
        text: { type: 'mrkdwn', text: results.join('\n') },
      }] : []),
    ],
  }
}

export function buildErrorBlock(message: string) {
  return {
    response_type: 'ephemeral',
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `❌ ${message}` } },
    ],
  }
}

export function buildBriefBlock(clientName: string, briefText: string, requestedBy: string) {
  return {
    response_type: 'in_channel',
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `📋 Brief: ${clientName}` } },
      { type: 'section', text: { type: 'mrkdwn', text: briefText } },
      { type: 'divider' },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `Wygenerował: @${requestedBy} · 77STF AI` }] },
    ],
  }
}

export function buildStatusBlock(data: {
  clients: number
  openTasks: number
  telegramToday: number
  errors: { source: string; created_at: string }[]
}) {
  const errorText = data.errors.length > 0
    ? data.errors.map(e => `• ${e.source}`).join('\n')
    : '✅ Brak błędów'

  return {
    response_type: 'ephemeral',
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '🖥️ Status systemu 77STF' } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Klienci:*\n${data.clients}` },
          { type: 'mrkdwn', text: `*Otwarte zadania:*\n${data.openTasks}` },
          { type: 'mrkdwn', text: `*Telegram dziś:*\n${data.telegramToday} msg` },
          { type: 'mrkdwn', text: `*Ostatnie błędy:*\n${errorText}` },
        ],
      },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `Sprawdzono: ${new Date().toLocaleString('pl')}` }] },
    ],
  }
}
