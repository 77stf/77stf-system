import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase'

// POST /api/quotes/followup
// Called by n8n when a quote has been pending >7 days
// Sends follow-up email via Resend + logs note to CRM
// Body: { quote_id: string }

export async function POST(req: Request) {
  const webhookSecret = req.headers.get('x-webhook-secret')?.trim()
  if (!webhookSecret || webhookSecret !== process.env.N8N_WEBHOOK_SECRET?.trim()) {
    return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
  }

  let quote_id: string
  try {
    const body = await req.json() as { quote_id?: string }
    if (!body.quote_id) return NextResponse.json({ error: 'Brak quote_id' }, { status: 400 })
    quote_id = body.quote_id
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()

  // Fetch quote with client details
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('id, title, status, client_id, updated_at, clients(name, owner_name, owner_email)')
    .eq('id', quote_id)
    .single()

  if (quoteError || !quote) {
    return NextResponse.json({ error: 'Wycena nie istnieje' }, { status: 404 })
  }

  if (quote.status !== 'sent') {
    return NextResponse.json({ ok: false, reason: 'quote_not_sent', status: quote.status })
  }

  const client = quote.clients as { name?: string; owner_name?: string; owner_email?: string } | null
  if (!client?.owner_email) {
    return NextResponse.json({ ok: false, reason: 'no_email', client: client?.name })
  }

  const days = Math.floor((Date.now() - new Date(quote.updated_at).getTime()) / (1000 * 60 * 60 * 24))
  const fromEmail = process.env.RESEND_FROM_EMAIL || '77stf@ds-ai.pl'
  const recipientName = client.owner_name || client.name || 'Szanowny Kliencie'

  // Send email via Resend
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `77STF <${fromEmail}>`,
      to: [client.owner_email],
      subject: `Pytanie ws. wyceny: ${quote.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; color: #1a1a1a;">
          <p>Dzień dobry, ${recipientName},</p>
          <p>Chciałem zapytać, czy miał/a Pan/i okazję zapoznać się z naszą wyceną
          <strong>${quote.title}</strong>, którą przesłaliśmy ${days} dni temu.</p>
          <p>Jeśli mają Państwo pytania, chętnie porozmawiam — wystarczy odpisać na tego maila
          lub skontaktować się bezpośrednio.</p>
          <p>Z poważaniem,<br/>Zespół 77STF<br/>
          <a href="https://ds-ai.pl">ds-ai.pl</a></p>
        </div>
      `,
    }),
  })

  if (!emailRes.ok) {
    const errText = await emailRes.text()
    await supabase.from('error_log').insert({
      source: 'api/quotes/followup',
      message: `Resend error: ${errText}`,
      metadata: { quote_id, client_email: client.owner_email },
    })
    return NextResponse.json({ ok: false, reason: 'email_failed', error: errText }, { status: 500 })
  }

  // Log note to CRM
  await supabase.from('client_notes').insert({
    client_id: quote.client_id,
    content: `Wysłano follow-up email ws. wyceny "${quote.title}" (${days} dni oczekiwania) na adres ${client.owner_email}.`,
    source: 'system',
    importance: 'medium',
  })

  return NextResponse.json({
    ok: true,
    email_sent_to: client.owner_email,
    quote_title: quote.title,
    days_pending: days,
  })
}
