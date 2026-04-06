import { z } from 'zod'

// ── Clients ───────────────────────────────────────────────────────────────────

export const CreateClientSchema = z.object({
  name:        z.string().min(2, 'Nazwa musi mieć min. 2 znaki').max(100),
  industry:    z.string().max(100).optional(),
  size:        z.string().max(50).optional(),
  owner_name:  z.string().max(100).optional(),
  owner_email: z.string().email('Nieprawidłowy email').optional().or(z.literal('')),
  owner_phone: z.string().max(20).optional(),
  status:      z.enum(['lead', 'active', 'partner', 'closed']).default('lead'),
  source:      z.string().max(100).optional(),
  notes:       z.string().max(2000).optional(),
})

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const CreateTaskSchema = z.object({
  title:       z.string().min(1, 'Tytuł jest wymagany').max(200),
  description: z.string().max(2000).optional(),
  client_id:   z.string().uuid('Nieprawidłowe ID klienta').optional().nullable(),
  priority:    z.enum(['low', 'medium', 'high']).default('medium'),
  status:      z.enum(['todo', 'in_progress', 'done']).default('todo'),
  due_date:    z.string().datetime().optional().nullable(),
})

export const UpdateTaskSchema = z.object({
  status:   z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  due_date: z.string().datetime().optional().nullable(),
  title:    z.string().min(1).max(200).optional(),
})

// ── Quotes ────────────────────────────────────────────────────────────────────

export const QuoteItemSchema = z.object({
  name:        z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category:    z.enum(['setup', 'monthly', 'onetime']),
  price:       z.number().nonnegative().max(10_000_000),
  quantity:    z.number().int().positive().default(1),
  sort_order:  z.number().int().nonnegative().optional(),
})

export const CreateQuoteSchema = z.object({
  client_id:   z.string().uuid('Nieprawidłowe ID klienta'),
  title:       z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  valid_until: z.string().datetime().optional().nullable(),
  discount_pct: z.number().min(0).max(100).default(0),
  items:       z.array(QuoteItemSchema).min(1, 'Wycena musi mieć przynajmniej jedną pozycję'),
})

export const UpdateQuoteStatusSchema = z.object({
  status:           z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']),
  rejection_reason: z.string().max(500).optional(),
})

// ── Audits ────────────────────────────────────────────────────────────────────

export const CreateAuditSchema = z.object({
  client_id: z.string().uuid('Nieprawidłowe ID klienta'),
  title:     z.string().max(200).optional(),
})

export const CreateQuoteFromAuditSchema = z.object({
  variant_selections: z.record(z.string(), z.enum(['A', 'B', 'C'])).optional(),
})

// ── Notes / Ingest ────────────────────────────────────────────────────────────

export const IngestSchema = z.object({
  raw_text: z.string().min(1, 'Tekst jest wymagany').max(50_000),
  source:   z.string().max(50).optional(),
})

// ── Slack Webhook ─────────────────────────────────────────────────────────────

export const SlackIngestSchema = z.object({
  text:    z.string().min(1).max(10_000),
  user_id: z.string().max(50).optional(),
  channel: z.string().max(100).optional(),
})
