-- ============================================================
-- 77STF — Migration 005: Lifecycle dates + Attribution
-- Dodaje kluczowe pola których brak będzie boleć za 6-12 miesięcy
-- Paste into Supabase SQL Editor and run.
-- BEZPIECZNE: tylko ALTER TABLE ADD COLUMN IF NOT EXISTS
-- ============================================================

-- ── 1. CLIENTS — lifecycle dates ──────────────────────────────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS first_contacted_at   timestamptz,           -- kiedy pierwszy kontakt
  ADD COLUMN IF NOT EXISTS converted_at         timestamptz,           -- kiedy zmienił status na active
  ADD COLUMN IF NOT EXISTS last_activity_at     timestamptz,           -- kiedy ostatnia interakcja (auto-update)
  ADD COLUMN IF NOT EXISTS churn_at             timestamptz,           -- kiedy zamknięty/utracony
  ADD COLUMN IF NOT EXISTS churn_reason         text,                  -- dlaczego odszedł
  ADD COLUMN IF NOT EXISTS created_by           text,                  -- email/imię właściciela który dodał
  ADD COLUMN IF NOT EXISTS tags                 text[] DEFAULT '{}';   -- ["farmacja","rpa","voice"]

-- Backfill: dla istniejących klientów first_contacted_at = created_at (najlepsza dostępna wartość)
UPDATE clients SET first_contacted_at = created_at WHERE first_contacted_at IS NULL;

-- ── 2. LEADS — linkage do klientów ───────────────────────────────────────────
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS converted_to_client_id  uuid REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at            timestamptz,        -- kiedy lead stał się klientem
  ADD COLUMN IF NOT EXISTS lost_at                 timestamptz,        -- kiedy utracony
  ADD COLUMN IF NOT EXISTS lost_reason             text,               -- cena | zakres | timing | konkurencja | brak budżetu
  ADD COLUMN IF NOT EXISTS estimated_value_pln     numeric(10,2),      -- szacowana wartość dealu
  ADD COLUMN IF NOT EXISTS created_by              text;               -- kto dodał lead

-- ── 3. QUOTES — rejection tracking ──────────────────────────────────────────
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS rejected_at    timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,                      -- cena | zakres | timing | konkurencja | brak budżetu
  ADD COLUMN IF NOT EXISTS created_by     text;                        -- kto napisał wycenę

-- ── 4. MEETINGS — pipeline metrics ───────────────────────────────────────────
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS duration_minutes          integer,           -- czas trwania spotkania
  ADD COLUMN IF NOT EXISTS meeting_type              text,              -- kickoff | check-in | demo | problem | negotiation
  ADD COLUMN IF NOT EXISTS next_meeting_scheduled_at timestamptz,       -- kiedy następne
  ADD COLUMN IF NOT EXISTS sentiment_after           text,              -- positive | neutral | negative | unknown
  ADD COLUMN IF NOT EXISTS created_by                text;              -- kto prowadził spotkanie

-- ── 5. AUTOMATIONS — health tracking ─────────────────────────────────────────
ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS deployed_at               timestamptz,       -- kiedy wdrożono
  ADD COLUMN IF NOT EXISTS paused_at                 timestamptz,       -- kiedy ostatnio wstrzymano
  ADD COLUMN IF NOT EXISTS error_at                  timestamptz,       -- kiedy ostatni błąd
  ADD COLUMN IF NOT EXISTS error_count_total         integer DEFAULT 0, -- łączna liczba błędów
  ADD COLUMN IF NOT EXISTS monthly_value_pln         numeric(10,2),     -- szacowana wartość/mies (z audytu)
  ADD COLUMN IF NOT EXISTS hours_saved_per_month     numeric(6,2),      -- godziny oszczędzone/mies
  ADD COLUMN IF NOT EXISTS owner_name                text;              -- kto jest odpowiedzialny w teamie

-- ── 6. PROJECTS — cost + attribution ─────────────────────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS created_by          text,                    -- kto prowadzi projekt
  ADD COLUMN IF NOT EXISTS actual_delivery_date date,                   -- faktyczna data dostawy (vs planned delivery_date)
  ADD COLUMN IF NOT EXISTS estimated_hours     numeric(6,1),            -- szacunkowe godziny pracy
  ADD COLUMN IF NOT EXISTS churn_at            timestamptz,             -- kiedy klient odszedł/projekt zakończony
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz DEFAULT now(); -- kiedy ostatnia zmiana

-- ── 7. AI_USAGE_LOG — project attribution ───────────────────────────────────
ALTER TABLE ai_usage_log
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS audit_id   uuid REFERENCES audits(id)   ON DELETE SET NULL;

-- Indices na nowe kolumny wyszukiwania
CREATE INDEX IF NOT EXISTS clients_last_activity_idx  ON clients (last_activity_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS clients_tags_idx           ON clients USING GIN (tags);
CREATE INDEX IF NOT EXISTS leads_converted_client_idx ON leads (converted_to_client_id) WHERE converted_to_client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS automations_status_idx     ON automations (status, error_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS ai_usage_project_idx       ON ai_usage_log (project_id) WHERE project_id IS NOT NULL;

-- ── Verification ─────────────────────────────────────────────────────────────
SELECT
  table_name,
  (SELECT count(*) FROM information_schema.columns c
   WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS col_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('clients', 'leads', 'quotes', 'meetings', 'automations', 'projects', 'ai_usage_log')
ORDER BY table_name;
