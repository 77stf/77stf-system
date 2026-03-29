'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { t } from '@/lib/tokens'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('Nieprawidłowy email lub hasło.')
      setLoading(false)
      return
    }

    router.push(next)
    router.refresh()
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: t.bg.page,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        // Dot grid overlay
        backgroundImage:
          'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: t.radius.sm,
              background: t.brand.gradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.04em',
              flexShrink: 0,
              boxShadow: '0 2px 14px rgba(196,154,46,0.40)',
            }}
          >
            77
          </div>
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                background: t.brand.gradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              77STF
            </div>
            <div
              style={{
                fontSize: 10,
                color: t.text.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.20em',
                marginTop: 1,
              }}
            >
              System Wewnętrzny
            </div>
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            backgroundColor: t.bg.card,
            border: `1px solid ${t.border.default}`,
            borderRadius: t.radius.lg,
            padding: '36px 32px',
            boxShadow: t.shadow.cardLg,
            backdropFilter: 'blur(20px)',
          }}
        >
          <h1
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: t.text.primary,
              letterSpacing: '-0.025em',
              marginBottom: 6,
            }}
          >
            Logowanie
          </h1>
          <p
            style={{
              fontSize: 13,
              color: t.text.muted,
              marginBottom: 28,
              lineHeight: 1.5,
            }}
          >
            Zaloguj się do panelu operacyjnego 77STF.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                htmlFor="email"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: t.text.secondary,
                  letterSpacing: '0.01em',
                }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@77stf.pl"
                style={{
                  backgroundColor: t.bg.input,
                  border: `1px solid ${error ? t.border.error : t.border.default}`,
                  borderRadius: t.radius.sm,
                  padding: '10px 14px',
                  fontSize: 14,
                  color: t.text.primary,
                  outline: 'none',
                  transition: 'border-color 150ms',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = t.brand.gold
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = error ? t.border.error : t.border.default
                }}
              />
            </div>

            {/* Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                htmlFor="password"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: t.text.secondary,
                  letterSpacing: '0.01em',
                }}
              >
                Hasło
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  backgroundColor: t.bg.input,
                  border: `1px solid ${error ? t.border.error : t.border.default}`,
                  borderRadius: t.radius.sm,
                  padding: '10px 14px',
                  fontSize: 14,
                  color: t.text.primary,
                  outline: 'none',
                  transition: 'border-color 150ms',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = t.brand.gold
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = error ? t.border.error : t.border.default
                }}
              />
            </div>

            {/* Error message */}
            {error && (
              <div
                style={{
                  backgroundColor: t.semantic.errorBg,
                  border: `1px solid ${t.semantic.errorBorder}`,
                  borderRadius: t.radius.sm,
                  padding: '10px 14px',
                  fontSize: 13,
                  color: t.semantic.error,
                }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: loading ? t.brand.goldDark : t.brand.gold,
                color: '#fff',
                border: 'none',
                borderRadius: t.radius.sm,
                padding: '11px 24px',
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 150ms, opacity 150ms',
                opacity: loading ? 0.75 : 1,
                boxShadow: loading ? 'none' : t.shadow.btn,
                width: '100%',
                marginTop: 4,
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = t.brand.goldDark
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = t.brand.gold
              }}
            >
              {loading ? 'Logowanie…' : 'Zaloguj się'}
            </button>
          </form>
        </div>

        <p
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: t.text.muted,
          }}
        >
          © 2026 77STF — Zewnętrzny dział technologiczny
        </p>
      </div>
    </div>
  )
}
