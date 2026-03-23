import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export interface MeetingAnalysis {
  summary: string
  decisions: string[]
  promises_us: { text: string; deadline?: string }[]
  promises_client: { text: string; deadline?: string }[]
  pain_points: string[]
  red_flags: string[]
  tasks: { text: string; assignee: string; deadline?: string }[]
}

export async function analyzeMeeting(transcript: string): Promise<MeetingAnalysis> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    system: 'Jesteś asystentem który analizuje transkrypty spotkań biznesowych. Odpowiadaj WYŁĄCZNIE w JSON bez żadnego dodatkowego tekstu.',
    messages: [
      {
        role: 'user',
        content: `Przeanalizuj transkrypt spotkania. Zwróć TYLKO JSON bez markdown, bez backticks, bez żadnego tekstu przed lub po. Format: {summary, decisions, promises_us, promises_client, pain_points, red_flags, tasks}\n\nTranskrypt:\n${transcript}`,
      },
    ],
  })

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
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