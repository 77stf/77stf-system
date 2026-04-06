import { Settings, CheckCircle, XCircle, AlertCircle, ExternalLink, Mail, Calendar, FileText, Zap, Key, Shield, DollarSign } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { t } from '@/lib/tokens'

// ─── Env status helpers (server-side only) ────────────────────────────────────

function getEnvStatus() {
  return {
    // Auth
    supabase_url:        !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_anon:       !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabase_service:    !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    // AI
    anthropic:           !!process.env.ANTHROPIC_API_KEY,
    // Budget
    ai_budget:           process.env.AI_MONTHLY_BUDGET_USD ?? null,
    usd_pln_rate:        process.env.USD_PLN_RATE ?? null,
    // Admin
    admin_emails:        process.env.ADMIN_EMAILS ?? null,
    // n8n
    n8n_secret:          !!process.env.N8N_WEBHOOK_SECRET,
    // Email
    resend:              !!process.env.RESEND_API_KEY,
  }
}

// ─── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ ok, warn }: { ok: boolean; warn?: boolean }) {
  if (ok) return <CheckCircle size={14} style={{ color: '#4ade80', flexShrink: 0 }} />
  if (warn) return <AlertCircle size={14} style={{ color: '#fbbf24', flexShrink: 0 }} />
  return <XCircle size={14} style={{ color: '#f87171', flexShrink: 0 }} />
}

function Row({ label, ok, value, warn, hint }: { label: string; ok: boolean; value?: string | null; warn?: boolean; hint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${t.border.subtle}` }}>
      <StatusDot ok={ok} warn={warn} />
      <span style={{ fontSize: 13, color: t.text.secondary, flex: 1 }}>{label}</span>
      {value && <span style={{ fontSize: 12, color: t.text.muted, fontFamily: 'monospace' }}>{value}</span>}
      {hint && !ok && <span style={{ fontSize: 11, color: warn ? '#fbbf24' : '#f87171' }}>{hint}</span>}
    </div>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div style={{ background: t.bg.card, border: `1px solid ${t.border.default}`, borderRadius: 10, padding: '20px 22px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Icon size={15} style={{ color: t.text.muted }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: t.text.secondary, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default async function SettingsPage() {
  const auth = await createSupabaseServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) notFound()

  const env = getEnvStatus()

  // Determine auth methods
  const provider = user.app_metadata?.provider as string | undefined
  const isGoogle = provider === 'google'
  const isMagicLink = provider === 'email' || !provider

  return (
    <div style={{ padding: '28px 32px', maxWidth: 760 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: `1px solid ${t.border.default}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Settings size={18} style={{ color: t.text.muted }} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text.primary, margin: 0 }}>Ustawienia</h1>
          <p style={{ fontSize: 13, color: t.text.muted, margin: 0 }}>Konfiguracja systemu, klucze API, integracje</p>
        </div>
      </div>

      {/* Current user */}
      <Section title="Konto" icon={Shield}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <Row label="Email" ok={true} value={user.email ?? '—'} />
          <Row label="Magic Link (email)" ok={isMagicLink || isGoogle} value={isMagicLink ? 'aktywne' : undefined} />
          <Row
            label="Google OAuth"
            ok={isGoogle}
            warn={!isGoogle}
            value={isGoogle ? 'aktywne' : undefined}
            hint={!isGoogle ? 'Skonfiguruj w Supabase → Auth → Providers → Google' : undefined}
          />
          <div style={{ paddingTop: 6 }}>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#818CF8', textDecoration: 'none' }}
            >
              Supabase Dashboard <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </Section>

      {/* API Keys status */}
      <Section title="Klucze API" icon={Key}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <Row label="Supabase URL" ok={env.supabase_url} hint="Brak NEXT_PUBLIC_SUPABASE_URL" />
          <Row label="Supabase Anon Key" ok={env.supabase_anon} hint="Brak NEXT_PUBLIC_SUPABASE_ANON_KEY" />
          <Row label="Supabase Service Role" ok={env.supabase_service} hint="Brak SUPABASE_SERVICE_ROLE_KEY" />
          <Row label="Anthropic API Key" ok={env.anthropic} hint="Brak ANTHROPIC_API_KEY — AI nie działa" />
          <Row label="Resend (email)" ok={env.resend} warn={!env.resend} hint="Opcjonalny — do wysyłki emaili" />
          <div style={{ paddingTop: 8, fontSize: 11, color: t.text.muted }}>
            Klucze ustawiaj w <code style={{ background: t.bg.muted, padding: '1px 5px', borderRadius: 3 }}>.env.local</code> (dev) i Vercel Environment Variables (prod). Nigdy nie commituj .env.local.
          </div>
        </div>
      </Section>

      {/* AI Budget */}
      <Section title="Budżet AI" icon={DollarSign}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <Row
            label="AI_MONTHLY_BUDGET_USD"
            ok={!!env.ai_budget}
            value={env.ai_budget ? `$${env.ai_budget}/mies.` : null}
            warn={!env.ai_budget}
            hint={!env.ai_budget ? 'Dodaj do .env.local (np. 50)' : undefined}
          />
          <Row
            label="USD_PLN_RATE"
            ok={!!env.usd_pln_rate}
            value={env.usd_pln_rate ? `${env.usd_pln_rate} PLN/$` : null}
            warn={!env.usd_pln_rate}
            hint={!env.usd_pln_rate ? 'Dodaj do .env.local (np. 4.0)' : undefined}
          />
          <Row
            label="ADMIN_EMAILS"
            ok={!!env.admin_emails}
            value={env.admin_emails ? `${env.admin_emails.split(',').length} adres(y)` : null}
            warn={!env.admin_emails}
            hint={!env.admin_emails ? 'Dodaj do .env.local — potrzebne do DELETE /api/errors' : undefined}
          />
          <div style={{ paddingTop: 6 }}>
            <a href="/dashboard/ai-costs" style={{ fontSize: 12, color: '#818CF8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Otwórz Koszty AI →
            </a>
          </div>
        </div>
      </Section>

      {/* n8n */}
      <Section title="Automatyzacje (n8n)" icon={Zap}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <Row
            label="N8N_WEBHOOK_SECRET"
            ok={env.n8n_secret}
            warn={!env.n8n_secret}
            hint={!env.n8n_secret ? 'Potrzebny do /api/webhooks/slack-ingest' : undefined}
          />
          <div style={{ paddingTop: 8 }}>
            <div style={{ fontSize: 12, color: t.text.muted, lineHeight: 1.7 }}>
              <strong style={{ color: t.text.secondary }}>Dostępne endpointy webhook:</strong><br />
              <code style={{ background: t.bg.muted, padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>POST /api/webhooks/slack-ingest</code> — Slack #quick-notes → CRM<br />
              <code style={{ background: t.bg.muted, padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>POST /api/intelligence/radar/run</code> — n8n cron → World Radar digest<br />
              <code style={{ background: t.bg.muted, padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>POST /api/guardian/run</code> — n8n cron → Guardian check
            </div>
          </div>
        </div>
      </Section>

      {/* MCP Integrations */}
      <Section title="Integracje MCP (Claude Code)" icon={FileText}>
        <div style={{ fontSize: 12, color: t.text.muted, lineHeight: 1.7, marginBottom: 14 }}>
          MCP narzędzia dostępne w sesjach Claude Code — aktywne automatycznie, bez dodatkowej konfiguracji.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <Row label="Gmail MCP" ok={true} value="aktywny w Claude Code" />
          <Row label="Google Calendar MCP" ok={true} value="aktywny w Claude Code" />
          <Row label="Notion MCP" ok={true} value="aktywny w Claude Code" />
          <Row label="Canva MCP" ok={true} value="aktywny w Claude Code" />
          <div style={{ paddingTop: 8, fontSize: 11, color: t.text.muted }}>
            Użyj w sesji Claude: &quot;Sprawdź maile od Avvlo&quot; / &quot;Co mam jutro w kalendarzu?&quot; / &quot;Zapisz do Notion&quot;
          </div>
        </div>
      </Section>

      {/* Pending migrations */}
      <Section title="Migracje bazy danych" icon={Shield}>
        <div style={{ fontSize: 12, color: t.text.muted, lineHeight: 1.8, marginBottom: 10 }}>
          Uruchom w Supabase SQL Editor w kolejności:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { file: '009_intelligence_digests.sql', desc: 'World Radar — historia digestów' },
            { file: '010_guardian.sql',              desc: 'Guardian Agent — historia raportów' },
          ].map(m => (
            <div key={m.file} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: t.bg.muted, borderRadius: 6 }}>
              <AlertCircle size={12} style={{ color: '#fbbf24', flexShrink: 0 }} />
              <code style={{ fontSize: 12, color: t.text.secondary, flex: 1 }}>{m.file}</code>
              <span style={{ fontSize: 11, color: t.text.muted }}>{m.desc}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#818CF8', textDecoration: 'none' }}
          >
            Otwórz Supabase SQL Editor <ExternalLink size={10} />
          </a>
        </div>
      </Section>

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {[
          { label: 'Koszty AI', href: '/dashboard/ai-costs', icon: DollarSign },
          { label: 'Logi błędów', href: '/dashboard/errors', icon: AlertCircle },
          { label: 'Guardian Agent', href: '/dashboard/guardian', icon: Shield },
          { label: 'Intelligence Hub', href: '/dashboard/intelligence', icon: Zap },
        ].map(link => {
          const Icon = link.icon
          return (
            <a key={link.href} href={link.href} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: t.bg.card, border: `1px solid ${t.border.subtle}`, borderRadius: 8, textDecoration: 'none', color: t.text.secondary, fontSize: 13 }}>
              <Icon size={14} style={{ color: t.text.muted }} /> {link.label}
            </a>
          )
        })}
      </div>
    </div>
  )
}
