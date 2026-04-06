-- Migration 006: Add context_data to audits
-- Stores consultant's financial baseline + external context for AI analysis
-- Safe: ALTER TABLE with IF NOT EXISTS, no data loss

ALTER TABLE audits ADD COLUMN IF NOT EXISTS context_data JSONB DEFAULT '{}';
ALTER TABLE audits ADD COLUMN IF NOT EXISTS implementations JSONB DEFAULT '[]';
ALTER TABLE audits ADD COLUMN IF NOT EXISTS financial_summary JSONB DEFAULT '{}';

-- context_data shape:
-- {
--   revenue_range: '<50k' | '50-200k' | '200-500k' | '500k-2M' | '>2M',
--   team_sales: number,
--   team_cs: number,
--   team_ops: number,
--   hourly_cost_pln: number,
--   budget_setup: '<10k' | '10-30k' | '30-80k' | '>80k',
--   budget_monthly: '<1k' | '1-3k' | '3-6k' | '>6k',
--   decision_maker: 'owner' | 'board' | 'investor',
--   timeline: 'now' | '1-3m' | 'planning',
--   external_context: string   -- consultant notes: Google Maps, competitors, market
-- }
