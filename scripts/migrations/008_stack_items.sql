-- Migration 008: Stack Intelligence Panel
-- Stack items = all automation/integration/ai implementations per client
-- Used by React Flow visual tree in /dashboard/clients/[id]/stack

CREATE TABLE IF NOT EXISTS stack_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'automation',
    -- automation | integration | ai_agent | data | voice | reporting
  status TEXT NOT NULL DEFAULT 'idea',
    -- idea | planned | in_progress | live | deprecated | error
  description TEXT,
  -- Links to existing entities
  implementation_id TEXT,  -- ref to audit implementation name (text key)
  automation_id UUID,      -- link to automations table
  quote_item_id UUID,      -- link to quote_items table
  -- Financials
  monthly_value_pln NUMERIC(10,2),
  setup_cost_pln NUMERIC(10,2),
  -- Dependencies between stack items (array of stack_item IDs)
  depends_on UUID[] DEFAULT '{}',
  -- Flexible extra data
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast per-client queries
CREATE INDEX IF NOT EXISTS idx_stack_items_client_id ON stack_items(client_id);

-- RLS
ALTER TABLE stack_items ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (internal dashboard only)
CREATE POLICY "stack_items_auth_all" ON stack_items
  FOR ALL USING (auth.role() = 'authenticated');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_stack_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stack_items_updated_at
  BEFORE UPDATE ON stack_items
  FOR EACH ROW EXECUTE FUNCTION update_stack_items_updated_at();
