 -- ============================================================
-- 77STF — Migration 005: ai_usage_log — extended columns
-- Dodaje: stop_reason, response_time_ms, cache_read_tokens,
--         triggered_by, metadata
-- Run AFTER 004_ai_usage_log.sql (now 005 in sequence)
-- ============================================================

ALTER TABLE ai_usage_log
  ADD COLUMN IF NOT EXISTS stop_reason        text,                    -- 'end_turn' | 'max_tokens' | 'stop_sequence'
  ADD COLUMN IF NOT EXISTS response_time_ms   integer,                 -- czas trwania requestu
  ADD COLUMN IF NOT EXISTS cache_read_tokens  integer NOT NULL DEFAULT 0, -- tokeny z Anthropic prompt cache (tańsze)
  ADD COLUMN IF NOT EXISTS triggered_by       text NOT NULL DEFAULT 'user', -- 'user' | 'guardian' | 'webhook' | 'cron'
  ADD COLUMN IF NOT EXISTS metadata           jsonb;                   -- flexible bucket na przyszłość

-- Index na stop_reason — szybkie zapytania o truncacje
CREATE INDEX IF NOT EXISTS ai_usage_log_stop_reason_idx ON ai_usage_log (stop_reason) WHERE stop_reason = 'max_tokens';

-- ── Verification ─────────────────────────────────────────────────────────────
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'ai_usage_log' AND table_schema = 'public'
ORDER BY ordinal_position;
