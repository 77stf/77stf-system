'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { t } from '@/lib/tokens'

type LoginMode = 'password' | 'magic'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'
  const urlError = searchParams.get('error')

  const [mode, setMode] = useState<LoginMode>('magic')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(urlError === 'auth_callback_failed' ? 'Link logowania wygasł — spróbuj ponownie.' : '')
  const [loading, setLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  )

  // ─── Google OAuth ─────────────────────────────────────────────────────────
  async function handleGoogle() {
    setError('')
    setLoading(true)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (oauthError) {
      setError('Błąd logowania Google — sprawdź czy Google OAuth jest skonfigurowane w Supabase.')
      setLoading(false)
    }
    // On success: browser redirects to Google, no further action needed
  }

  // ─── Magic Link ───────────────────────────────────────────────────────────
  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    setLoading(false)
    if (otpError) {
      setError('Nie udało się wysłać linku — sprawdź email.')
    } else {
      setMagicSent(true)
    }
  }

  // ─── Password ─────────────────────────────────────────────────────────────
  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('Nieprawidłowy email lub hasło.')
      setLoading(false)
      return
    }
    router.push(next)
    router.refresh()
  }

  // ─── Input shared styles ──────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    backgroundColor: t.bg.input,
    border: `1px solid ${error ? t.border.error : t.border.default}`,
    borderRadius: t.radius.sm,
    padding: '10px 14px',
    fontSize: 14,
    color: t.text.primary,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: t.bg.page,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundImage: 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
      backgroundSize: '32px 32px',
    }}>
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: t.radius.sm,
            background: t.brand.gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em',
            flexShrink: 0, boxShadow: '0 2px 14px rgba(196,154,46,0.40)',
          }}>
            77
          </div>
          <div>
            <div style={{
              fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em',
              background: t.brand.gradient, WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              77STF
            </div>
            <div style={{ fontSize: 10, color: t.text.muted, textTransform: 'uppercase', letterSpacing: '0.20em', marginTop: 1 }}>
              System Wewnętrzny
            </div>
          </div>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: t.bg.card,
          border: `1px solid ${t.border.default}`,
          borderRadius: t.radius.lg,
          padding: '36px 32px',
          boxShadow: t.shadow.cardLg,
          backdropFilter: 'blur(20px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: t.text.primary, letterSpacing: '-0.025em', marginBottom: 4 }}>
              Logowanie
            </h1>
            <p style={{ fontSize: 13, color: t.text.muted, lineHeight: 1.5 }}>
              Zaloguj się do panelu operacyjnego 77STF.
            </p>
          </div>

          {/* Google button */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%', padding: '11px 16px',
              background: 'rgba(255,255,255,0.07)', border: `1px solid ${t.border.default}`,
              borderRadius: t.radius.sm, color: t.text.primary,
              fontSize: 14, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(255,255,255,0.11)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
          >
            {/* Google SVG icon */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Zaloguj się z Google
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: t.border.subtle }} />
            <span style={{ color: t.text.muted, fontSize: 12 }}>lub</span>
            <div style={{ flex: 1, height: 1, background: t.border.subtle }} />
          </div>

          {/* Mode tabs */}
          <div style={{
            display: 'flex', background: t.bg.muted, borderRadius: t.radius.sm,
            padding: 3, gap: 2,
          }}>
            {([['magic', 'Magic Link'], ['password', 'Hasło']] as [LoginMode, string][]).map(([m, label]) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setMagicSent(false) }}
                style={{
                  flex: 1, padding: '7px 0', fontSize: 13, fontWeight: 600,
                  border: 'none', borderRadius: t.radius.xs, cursor: 'pointer',
                  background: mode === m ? t.bg.cardSolid : 'transparent',
                  color: mode === m ? t.text.primary : t.text.muted,
                  boxShadow: mode === m ? t.shadow.sm : 'none',
                  transition: 'all 0.12s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Magic Link sent confirmation */}
          {magicSent ? (
            <div style={{
              background: t.semantic.successBg, border: `1px solid ${t.semantic.successBorder}`,
              borderRadius: t.radius.sm, padding: '14px 16px',
              color: t.semantic.success, fontSize: 13, lineHeight: 1.5,
            }}>
              ✓ Link wysłany na <strong>{email}</strong>.<br />
              Sprawdź skrzynkę i kliknij link aby się zalogować.
            </div>
          ) : mode === 'magic' ? (
            <form onSubmit={handleMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: t.text.secondary }}>Email</label>
                <input
                  type="email" required autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin@77stf.pl"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = t.brand.gold }}
                  onBlur={e => { e.currentTarget.style.borderColor = error ? t.border.error : t.border.default }}
                />
              </div>
              {error && <ErrorBox message={error} />}
              <button type="submit" disabled={loading} style={submitBtnStyle(loading, t)}>
                {loading ? 'Wysyłam...' : 'Wyślij Magic Link'}
              </button>
              <p style={{ color: t.text.muted, fontSize: 11, textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
                Klikniesz link w mailu → jesteś zalogowany. Bez hasła.
              </p>
            </form>
          ) : (
            <form onSubmit={handlePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: t.text.secondary }}>Email</label>
                <input
                  type="email" required autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin@77stf.pl" style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = t.brand.gold }}
                  onBlur={e => { e.currentTarget.style.borderColor = error ? t.border.error : t.border.default }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: t.text.secondary }}>Hasło</label>
                <input
                  type="password" required autoComplete="current-password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = t.brand.gold }}
                  onBlur={e => { e.currentTarget.style.borderColor = error ? t.border.error : t.border.default }}
                />
              </div>
              {error && <ErrorBox message={error} />}
              <button type="submit" disabled={loading} style={submitBtnStyle(loading, t)}>
                {loading ? 'Logowanie…' : 'Zaloguj się'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: t.text.muted }}>
          © 2026 77STF — Zewnętrzny dział technologiczny
        </p>
      </div>
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{
      backgroundColor: 'rgba(248,113,113,0.09)',
      border: '1px solid rgba(248,113,113,0.22)',
      borderRadius: 8, padding: '10px 14px',
      fontSize: 13, color: '#f87171',
    }}>
      {message}
    </div>
  )
}

function submitBtnStyle(loading: boolean, tokens: typeof t): React.CSSProperties {
  return {
    backgroundColor: loading ? tokens.brand.goldDark : tokens.brand.gold,
    color: '#fff', border: 'none', borderRadius: tokens.radius.sm,
    padding: '11px 24px', fontSize: 14, fontWeight: 600,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.75 : 1,
    boxShadow: loading ? 'none' : tokens.shadow.btn,
    width: '100%', marginTop: 4,
    transition: 'background-color 150ms, opacity 150ms',
  }
}
