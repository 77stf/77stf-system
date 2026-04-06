// Rate limiting — in-memory Map, no external dependencies
// Resets automatically when window expires per key

const store = new Map<string, { count: number; resetAt: number }>()

/**
 * Returns true if request is allowed, false if rate limit exceeded.
 * @param key     Unique key per user+action (e.g. `analyze:${user.id}`)
 * @param limit   Max requests allowed in the window
 * @param windowMs  Window duration in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) return false

  entry.count++
  return true
}

// Rate limit presets for common operations
export const RATE_LIMITS = {
  AI_ANALYZE:    { limit: 3,  windowMs: 60_000 }, // 3 req/min — expensive Claude call
  AI_BRIEF:      { limit: 5,  windowMs: 60_000 }, // 5 req/min — meeting prep
  AI_INGEST:     { limit: 10, windowMs: 60_000 }, // 10 req/min — text ingestion
  API_GENERAL:   { limit: 60, windowMs: 60_000 }, // 60 req/min — standard endpoints
} as const
