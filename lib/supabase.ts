import { createClient } from '@supabase/supabase-js'
import { createServerClient as createSSRClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Klient po stronie klienta (browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Klient po stronie serwera z obsługą cookies (Server Components)
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createSSRClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {}
      },
    },
  })
}

// Klient z service role (API routes — omija RLS)
export function createSupabaseAdminClient() {
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}