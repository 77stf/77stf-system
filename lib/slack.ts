import crypto from 'crypto'

// ─── Slack Incoming Webhook — send messages to Slack ─────────────────────────

export async function sendSlackMessage(text: string, channel?: string): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn('[slack] SLACK_WEBHOOK_URL not set — message not sent')
    return false
  }

  try {
    const body: Record<string, unknown> = { text }
    if (channel) body.channel = channel

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
