-- 015_roadmap_pipeline.sql
-- GIGA UPDATE: Roadmap pipeline, presentations, costs, ideas, agent conversations, analyses
-- Run AFTER migrations 001-014

-- ============================================================
-- 1. PIPELINE STAGE on clients
-- ============================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'discovery';
-- Values: 'discovery' | 'audit' | 'proposal' | 'negotiation' | 'onboarding' | 'active' | 'partner'

CREATE INDEX IF NOT EXISTS idx_clients_pipeline_stage ON clients(pipeline_stage);

-- ============================================================
-- 2. ROADMAP STAGES — tracks when a client entered/exited each stage
-- ============================================================
CREATE TABLE IF NOT EXISTS roadmap_stages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  stage_key     text NOT NULL,
  entered_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  notes         text,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roadmap_stages_client ON roadmap_stages(client_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_stages_stage ON roadmap_stages(stage_key);

ALTER TABLE roadmap_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roadmap_stages_auth" ON roadmap_stages
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- 3. ROADMAP ACTIVITIES — log of all pipeline interactions
-- ============================================================
CREATE TABLE IF NOT EXISTS roadmap_activities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  stage_key       text NOT NULL,
  activity_type   text NOT NULL,
  -- 'call' | 'email' | 'meeting' | 'note' | 'quote_sent' | 'research' | 'demo' | 'document' | 'whatsapp' | 'stage_change'
  title           text NOT NULL,
  description     text,
  outcome         text,
  contact_person  text,
  scheduled_at    timestamptz,
  completed_at    timestamptz,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roadmap_activities_client ON roadmap_activities(client_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_activities_stage ON roadmap_activities(stage_key);
CREATE INDEX IF NOT EXISTS idx_roadmap_activities_created ON roadmap_activities(created_at DESC);

ALTER TABLE roadmap_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roadmap_activities_auth" ON roadmap_activities
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- 4. CLIENT RESEARCH — AI-gathered intelligence per client
-- ============================================================
CREATE TABLE IF NOT EXISTS client_research (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  source_type   text NOT NULL,
  -- 'website' | 'linkedin' | 'facebook' | 'instagram' | 'google_maps' | 'krs' | 'manual' | 'email'
  source_url    text,
  title         text NOT NULL,
  content       text NOT NULL,
  ai_summary    text,
  relevance     text NOT NULL DEFAULT 'medium',
  -- 'high' | 'medium' | 'low'
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_research_client ON client_research(client_id);
CREATE INDEX IF NOT EXISTS idx_client_research_type ON client_research(source_type);

ALTER TABLE client_research ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_research_auth" ON client_research
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- 5. PRESENTATIONS — per-client demo tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS presentations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title         text NOT NULL,
  status        text NOT NULL DEFAULT 'draft',
  -- 'draft' | 'ready' | 'presented' | 'follow_up'
  slides_data   jsonb DEFAULT '[]',
  qa_log        jsonb DEFAULT '[]',
  presented_at  timestamptz,
  feedback      text,
  canva_url     text,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presentations_client ON presentations(client_id);
CREATE INDEX IF NOT EXISTS idx_presentations_status ON presentations(status);

ALTER TABLE presentations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presentations_auth" ON presentations
  FOR ALL USING (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION update_presentations_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_presentations_updated
  BEFORE UPDATE ON presentations
  FOR EACH ROW EXECUTE FUNCTION update_presentations_updated_at();

-- ============================================================
-- 6. SUBSCRIPTION COSTS — all business costs (not just AI)
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_costs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  category        text NOT NULL,
  -- 'ai' | 'infrastructure' | 'tool' | 'service' | 'client_specific'
  client_id       uuid REFERENCES clients(id) ON DELETE SET NULL,
  amount_pln      numeric(10,2) NOT NULL,
  billing_cycle   text NOT NULL DEFAULT 'monthly',
  -- 'monthly' | 'yearly' | 'one_time'
  vendor          text,
  next_billing    date,
  active          boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_costs_category ON subscription_costs(category);
CREATE INDEX IF NOT EXISTS idx_subscription_costs_client ON subscription_costs(client_id);
CREATE INDEX IF NOT EXISTS idx_subscription_costs_active ON subscription_costs(active) WHERE active = true;

ALTER TABLE subscription_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscription_costs_auth" ON subscription_costs
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- 7. AGENT CONVERSATIONS — persistent chat history for Drugi Mozg
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  title       text,
  messages    jsonb NOT NULL DEFAULT '[]',
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_user ON agent_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_updated ON agent_conversations(updated_at DESC);

ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_conversations_own" ON agent_conversations
  FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_agent_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agent_conversations_updated
  BEFORE UPDATE ON agent_conversations
  FOR EACH ROW EXECUTE FUNCTION update_agent_conversations_updated_at();

-- ============================================================
-- 8. OFFLINE IDEAS — ideas for offline review + agent recommendations
-- ============================================================
CREATE TABLE IF NOT EXISTS offline_ideas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  category      text NOT NULL DEFAULT 'idea',
  -- 'implementation' | 'system_upgrade' | 'owner_idea' | 'tool' | 'integration'
  description   text,
  priority      text NOT NULL DEFAULT 'medium',
  -- 'critical' | 'high' | 'medium' | 'low'
  status        text NOT NULL DEFAULT 'new',
  -- 'new' | 'considering' | 'planned' | 'in_progress' | 'rejected' | 'done'
  source_agent  text,
  -- 'analyzer' | 'radar' | 'guardian' | 'second_brain' | 'manual'
  source_url    text,
  effort_hours  numeric(5,1),
  roi_notes     text,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offline_ideas_status ON offline_ideas(status);
CREATE INDEX IF NOT EXISTS idx_offline_ideas_category ON offline_ideas(category);
CREATE INDEX IF NOT EXISTS idx_offline_ideas_priority ON offline_ideas(priority);

ALTER TABLE offline_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offline_ideas_auth" ON offline_ideas
  FOR ALL USING (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION update_offline_ideas_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_offline_ideas_updated
  BEFORE UPDATE ON offline_ideas
  FOR EACH ROW EXECUTE FUNCTION update_offline_ideas_updated_at();

-- ============================================================
-- 9. IMPLEMENTATION ANALYSES — Analizator Wdrozen reports
-- ============================================================
CREATE TABLE IF NOT EXISTS implementation_analyses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type       text NOT NULL,
  -- 'ig_reel' | 'yt_short' | 'fb_post' | 'tiktok' | 'screenshot' | 'idea' | 'text'
  source_url        text,
  source_text       text,
  analysis          jsonb NOT NULL,
  -- structured report: { what_is_it, relevance_score, system_comparison, pros_cons, alternatives, recommendation }
  recommendation    text NOT NULL,
  -- 'implement' | 'monitor' | 'skip'
  relevance_score   integer CHECK (relevance_score >= 1 AND relevance_score <= 10),
  idea_id           uuid REFERENCES offline_ideas(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impl_analyses_recommendation ON implementation_analyses(recommendation);
CREATE INDEX IF NOT EXISTS idx_impl_analyses_created ON implementation_analyses(created_at DESC);

ALTER TABLE implementation_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "implementation_analyses_auth" ON implementation_analyses
  FOR ALL USING (auth.role() = 'authenticated');
