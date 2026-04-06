-- ============================================================
-- 77STF — Migration 001: quotes, quote_items, tasks
-- Paste into Supabase SQL Editor and run.
-- ============================================================

-- ── quotes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid        REFERENCES clients(id) ON DELETE CASCADE,
  title          text        NOT NULL,
  status         text        NOT NULL DEFAULT 'draft',   -- draft | sent | accepted | rejected | expired
  valid_until    date,
  setup_fee      integer     NOT NULL DEFAULT 0,         -- PLN netto (computed from items)
  monthly_fee    integer     NOT NULL DEFAULT 0,         -- PLN netto (computed from items)
  discount_pct   integer     NOT NULL DEFAULT 0,         -- 0-100
  notes          text,
  sent_at        timestamptz,
  accepted_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotes_select" ON quotes;
CREATE POLICY "quotes_select" ON quotes
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "quotes_insert" ON quotes;
CREATE POLICY "quotes_insert" ON quotes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "quotes_update" ON quotes;
CREATE POLICY "quotes_update" ON quotes
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "quotes_delete" ON quotes;
CREATE POLICY "quotes_delete" ON quotes
  FOR DELETE USING (auth.role() = 'authenticated');

-- ── quote_items ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quote_items (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    uuid    NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  name        text    NOT NULL,
  description text,
  category    text    NOT NULL DEFAULT 'setup',  -- setup | monthly | onetime
  price       integer NOT NULL DEFAULT 0,        -- PLN netto
  quantity    integer NOT NULL DEFAULT 1,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_items_select" ON quote_items;
CREATE POLICY "quote_items_select" ON quote_items
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "quote_items_insert" ON quote_items;
CREATE POLICY "quote_items_insert" ON quote_items
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "quote_items_update" ON quote_items;
CREATE POLICY "quote_items_update" ON quote_items
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "quote_items_delete" ON quote_items;
CREATE POLICY "quote_items_delete" ON quote_items
  FOR DELETE USING (auth.role() = 'authenticated');

-- ── tasks ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid    REFERENCES clients(id) ON DELETE SET NULL,
  title       text    NOT NULL,
  description text,
  status      text    NOT NULL DEFAULT 'todo',    -- todo | in_progress | done
  priority    text    NOT NULL DEFAULT 'medium',  -- low | medium | high
  due_date    date,
  done_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE USING (auth.role() = 'authenticated');

-- ── client_notes (if not yet created) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  content     text        NOT NULL,
  source      text        NOT NULL DEFAULT 'manual',  -- manual|meeting|instagram|research|call|linkedin
  source_url  text,
  tags        text[],
  importance  text        NOT NULL DEFAULT 'medium',  -- high|medium|low
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_notes_select" ON client_notes;
CREATE POLICY "client_notes_select" ON client_notes
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "client_notes_insert" ON client_notes;
CREATE POLICY "client_notes_insert" ON client_notes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "client_notes_update" ON client_notes;
CREATE POLICY "client_notes_update" ON client_notes
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "client_notes_delete" ON client_notes;
CREATE POLICY "client_notes_delete" ON client_notes
  FOR DELETE USING (auth.role() = 'authenticated');

-- ── updated_at trigger ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotes_updated_at ON quotes;
CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── verify ─────────────────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('quotes', 'quote_items', 'tasks', 'client_notes')
ORDER BY table_name;
