export type ClientStatus = 'lead' | 'active' | 'partner' | 'closed'
export type ProjectStatus = 'kickoff' | 'demo1' | 'demo2' | 'production' | 'delivered' | 'partner'
export type AutomationStatus = 'active' | 'error' | 'paused'
export type DocumentType = 'offer' | 'contract' | 'report'
export type PaymentStatus = 'pending' | 'partial' | 'paid'

export interface Client {
  id: string
  name: string
  industry?: string
  size?: string
  owner_name?: string
  owner_email?: string
  owner_phone?: string
  status: ClientStatus
  source?: string
  client_token: string
  notes?: string
  created_at: string
  // migration 005
  first_contacted_at?: string
  converted_at?: string
  last_activity_at?: string
  churn_at?: string
  churn_reason?: string
  created_by?: string
  tags?: string[]
}

export interface Project {
  id: string
  client_id: string
  type?: string
  status: ProjectStatus
  value_netto?: number
  start_date?: string
  delivery_date?: string
  payment_status: PaymentStatus
  notes?: string
  created_at: string
  // migration 005
  created_by?: string
  actual_delivery_date?: string
  estimated_hours?: number
  churn_at?: string
  updated_at?: string
}

export interface Automation {
  id: string
  project_id?: string
  client_id: string
  name: string
  status: AutomationStatus
  transactions_this_month: number
  last_ping: string
  error_message?: string
  created_at: string
  // migration 005
  deployed_at?: string
  paused_at?: string
  error_at?: string
  error_count_total?: number
  monthly_value_pln?: number
  hours_saved_per_month?: number
  owner_name?: string
}

export interface Meeting {
  id: string
  client_id: string
  date: string
  transcript_raw?: string
  summary_ai?: string
  decisions: string[]
  promises_us: { text: string; deadline?: string }[]
  promises_client: { text: string; deadline?: string }[]
  pain_points: string[]
  red_flags: string[]
  tasks: { text: string; assignee: string; deadline?: string }[]
  created_at: string
}

export interface Document {
  id: string
  client_id: string
  project_id?: string
  type: DocumentType
  status: string
  html_content?: string
  sent_at?: string
  created_at: string
}

export interface MonthlyReport {
  id: string
  client_id: string
  month: string
  transactions_total: number
  hours_saved: number
  value_saved_pln: number
  summary_text?: string
  sent_at?: string
  created_at: string
}

export interface GuardianReport {
  id: string
  date: string
  summary: string
  findings: {
    title: string
    description: string
    action: string
    priority: 'wysoki' | 'sredni' | 'niski'
    source: 'github' | 'tavily' | 'internal'
  }[]
  read_at?: string
  created_at: string
}

export interface Lead {
  id: string
  name?: string
  company?: string
  email?: string
  phone?: string
  source?: string
  status: string
  notes?: string
  created_at: string
}

export interface Referral {
  id: string
  referrer_client_id?: string
  referred_client_id?: string
  status: string
  reward_value?: number
  created_at: string
}

export interface ClientNote {
  id: string
  client_id: string
  content: string
  source: 'manual' | 'meeting' | 'instagram' | 'research' | 'call' | 'linkedin'
  source_url?: string
  tags?: string[]
  importance: 'high' | 'medium' | 'low'
  created_at: string
  created_by?: string
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'
export type QuoteItemCategory = 'setup' | 'monthly' | 'onetime'

export interface QuoteItem {
  id: string
  quote_id: string
  name: string
  description?: string
  category: QuoteItemCategory
  price: number
  quantity: number
  sort_order: number
  created_at: string
}

export interface Quote {
  id: string
  client_id: string
  title: string
  status: QuoteStatus
  valid_until?: string
  setup_fee: number
  monthly_fee: number
  discount_pct: number
  notes?: string
  sent_at?: string
  accepted_at?: string
  created_at: string
  updated_at: string
  // joined
  client?: Pick<Client, 'id' | 'name' | 'industry' | 'status'>
  items?: QuoteItem[]
}

export interface Task {
  id: string
  client_id?: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  due_date?: string
  done_at?: string
  created_at: string
  updated_at: string
  // joined
  client?: Pick<Client, 'id' | 'name'>
}

// ─── Audit AI output types ────────────────────────────────────────────────────

export interface AuditImplementationVariant {
  name: string
  scope: string
  setup_pln: number
  monthly_pln: number
  timeline_weeks: number
  what_you_get: string[]
  limitations: string | null
}

export interface AuditImplementation {
  name: string
  priority: number
  problem_solved: string
  annual_roi_pln: number
  roi_calculation: string
  payback_months: number
  pricing_rationale: string
  variants: AuditImplementationVariant[]
  recommended_variant: 'A' | 'B' | 'C'
  recommendation_reason: string
}

export interface AuditEcosystemPhase {
  phase: number
  name: string
  implementations: string[]
  rationale: string
}

export interface AuditFinancialSummary {
  total_annual_waste_pln: number
  total_addressable_roi_pln: number
  recommended_budget_setup_pln: number
  recommended_budget_monthly_pln: number
  roi_multiple: number
  payback_months_avg: number
}

export interface AuditContextData {
  revenue_range?: '<50k' | '50-200k' | '200-500k' | '500k-2M' | '>2M'
  team_sales?: number
  team_cs?: number
  team_ops?: number
  hourly_cost_pln?: number
  budget_setup?: '<10k' | '10-30k' | '30-80k' | '>80k'
  budget_monthly?: '<1k' | '1-3k' | '3-6k' | '>6k'
  decision_maker?: 'owner' | 'board' | 'investor'
  timeline?: 'now' | '1-3m' | 'planning'
  external_context?: string
}

export interface AuditAiResult {
  _scratchpad?: string
  summary: string
  overall_score: number
  scores: Record<string, number>
  findings: AuditFinding[]
  implementations: AuditImplementation[]
  ecosystem_roadmap: AuditEcosystemPhase[]
  financial_summary: AuditFinancialSummary
  quote_items: AuditQuoteItem[]
  tasks: { title: string; priority: string; due_days: number }[]
}

// ─── AI Usage types ───────────────────────────────────────────────────────────

export interface AiUsageLogEntry {
  id: string
  feature: string
  model: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  client_id: string | null
  created_at: string
}

export interface AiUsageStats {
  month: {
    cost_usd: number
    cost_pln: number
    total_calls: number
    total_input_tokens: number
    total_output_tokens: number
  }
  by_feature: { feature: string; cost_usd: number; calls: number }[]
  by_model: { model: string; cost_usd: number; calls: number }[]
  by_client: { client_id: string; client_name: string; cost_usd: number; calls: number }[]
  daily_trend: { date: string; cost_usd: number; calls: number }[]
  recent: AiUsageLogEntry[]
  usd_pln_rate: number
  projection_month_usd: number
  budget_usd: number | null
}

// ─── Audit types ──────────────────────────────────────────────────────────────

export type AuditStatus = 'in_progress' | 'analyzing' | 'completed'
export type AuditCategoryId = 'procesy' | 'technologia' | 'sprzedaz' | 'obsluga' | 'dane' | 'kontekst'
export type AuditSeverity = 'high' | 'medium' | 'low'

export interface AuditFinding {
  category: AuditCategoryId
  finding: string
  severity: AuditSeverity
  recommendation: string
}

export interface AuditQuoteItem {
  name: string
  description: string
  category: QuoteItemCategory
  price: number
  priority: number          // 1 (highest) to 5 (lowest)
}

export interface Audit {
  id: string
  client_id: string
  title: string
  status: AuditStatus
  score?: number            // 0-100 overall
  answers: Record<string, string>            // { question_id: answer }
  ai_scores?: Partial<Record<AuditCategoryId, number>>  // 0-100 per category
  findings?: AuditFinding[]
  recommendations?: AuditQuoteItem[]        // kept for compat
  ai_summary?: string
  ai_brief?: string
  quote_id?: string
  context_data?: AuditContextData
  created_at: string
  updated_at: string
  completed_at?: string
  // joined
  client?: Pick<Client, 'id' | 'name' | 'industry' | 'status'>
}

// ─── Stack Intelligence types ─────────────────────────────────────────────────

export type StackItemCategory = 'automation' | 'integration' | 'ai_agent' | 'data' | 'voice' | 'reporting'
export type StackItemStatus = 'idea' | 'planned' | 'in_progress' | 'live' | 'deprecated' | 'error'

export interface StackItem {
  id: string
  client_id: string
  name: string
  category: StackItemCategory
  status: StackItemStatus
  description?: string
  implementation_id?: string  // ref to audit implementation name
  automation_id?: string
  quote_item_id?: string
  monthly_value_pln?: number
  setup_cost_pln?: number
  depends_on: string[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}