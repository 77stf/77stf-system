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

// ─── Audit types ──────────────────────────────────────────────────────────────

export type AuditStatus = 'in_progress' | 'analyzing' | 'completed'
export type AuditCategoryId = 'procesy' | 'technologia' | 'sprzedaz' | 'obsluga' | 'dane'
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
  created_at: string
  updated_at: string
  completed_at?: string
  // joined
  client?: Pick<Client, 'id' | 'name' | 'industry' | 'status'>
}