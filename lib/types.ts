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