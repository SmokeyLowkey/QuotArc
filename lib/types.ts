// QuotArc — Core type definitions (aligned with Supabase schema)

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'expired'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'
export type DeliveryStatus = 'pending' | 'delivered' | 'failed'
export type LineItemCategory = 'material' | 'labor' | 'permit' | 'other'

export interface QuickReplyTemplate {
  id: string
  label: string
  body: string
}

export type PlanTier = 'free' | 'starter' | 'pro' | 'business'

export interface ReceptionistService {
  name: string
  description: string
  priceRange: string
}

export interface Profile {
  id: string
  email: string
  company_name: string
  phone: string | null
  address: string | null
  license_number: string | null
  logo_url: string | null
  default_tax_rate: number
  default_labor_rate: number
  follow_up_template: string | null
  quick_reply_templates: QuickReplyTemplate[]
  // Billing
  plan_status: string
  plan_tier: PlanTier
  voice_minutes_used: number
  voice_minutes_reset_at: string | null
  // Google Reviews
  google_place_id: string | null
  google_review_auto_send: boolean
  google_review_delay_hours: number
  // AI Receptionist
  vapi_phone_number_id: string | null
  vapi_phone_number: string | null
  receptionist_enabled: boolean
  receptionist_greeting: string | null
  receptionist_services: ReceptionistService[]
  receptionist_hours: Record<string, { start: string; end: string }>
  receptionist_transfer_number: string | null
  receptionist_date_overrides: Record<string, 'closed'>
  receptionist_instructions: string | null
  province: string | null
  timezone: string
  // Stripe Connect
  stripe_account_id: string | null
  stripe_onboarding_complete: boolean
  created_at: string
}

export interface Customer {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  province: string | null
  square_footage: number | null
  property_notes: string | null
  panel_size: string | null
  service_amps: string | null
  created_at: string
  updated_at: string
}

export interface JobTemplate {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string
  labor_hours_min: number | null
  labor_hours_max: number | null
  price_range_min: number | null
  price_range_max: number | null
  sort_order: number
}

export interface JobTemplateItem {
  id: string
  template_id: string
  description: string
  category: LineItemCategory
  default_qty: number
  unit: string
  price_range_low: number | null
  price_range_high: number | null
  is_conditional: boolean
  condition_note: string | null
  sort_order: number
}

export interface CodeNotes {
  inspection: string[]
  safety: string[]
  technical: string[]
}

export interface Quote {
  id: string
  user_id: string
  customer_id: string
  quote_number: string
  status: QuoteStatus
  job_type: string
  scope_notes: string | null
  subtotal: number
  tax_rate: number
  tax: number
  total: number
  auto_follow_up: boolean
  follow_up_days: number
  follow_up_count: number
  customer_note: string | null
  code_notes: CodeNotes | null
  public_token: string
  delivery_status: DeliveryStatus
  sent_at: string | null
  viewed_at: string | null
  accepted_at: string | null
  // E-signature
  signature_data: string | null
  signature_name: string | null
  signer_ip: string | null
  signer_user_agent: string | null
  signed_at: string | null
  expired_at: string | null
  next_follow_up: string | null
  created_at: string
  // Joined fields
  customer?: Customer
  line_items?: QuoteLineItem[]
  messages?: QuoteMessage[]
  jobs?: Job[]
  invoice?: { id: string; invoice_number: string; status: InvoiceStatus; total: number } | null
}

export interface QuoteLineItem {
  id: string
  quote_id: string
  description: string
  category: LineItemCategory
  quantity: number
  unit: string
  rate: number
  total: number
  is_template_item: boolean
  sort_order: number
}

export interface Invoice {
  id: string
  user_id: string
  customer_id: string
  quote_id: string | null
  invoice_number: string
  status: InvoiceStatus
  subtotal: number
  tax_rate: number
  tax: number
  total: number
  sent_at: string | null
  paid_at: string | null
  due_date: string | null
  created_at: string
  // Joined fields
  customer?: Customer
  line_items?: InvoiceLineItem[]
}

export interface InvoiceLineItem {
  id: string
  invoice_id: string
  description: string
  category: LineItemCategory
  quantity: number
  unit: string
  rate: number
  total: number
  sort_order: number
}

export type MessageDirection = 'outbound' | 'inbound'
export type MessageChannel = 'portal' | 'note'
export type MessageType = 'text' | 'image' | 'file' | 'audio' | 'quote_card' | 'invoice_card' | 'schedule_card'

export interface Attachment {
  url: string
  name: string
  type: string   // MIME type
  size: number   // bytes
}

export interface QuoteMessage {
  id: string
  quote_id: string
  user_id: string
  direction: MessageDirection
  channel: MessageChannel
  message_type: MessageType
  body: string
  sender_name: string
  attachments: Attachment[]
  metadata: Record<string, unknown>
  is_read: boolean
  read_at: string | null
  created_at: string
}

export type ActivityEventType =
  | 'quote_sent'
  | 'quote_viewed'
  | 'quote_follow_up'
  | 'quote_accepted'
  | 'quote_expired'
  | 'message_sent'
  | 'customer_replied'
  | 'invoice_sent'
  | 'invoice_paid'
  | 'invoice_reminder'
  | 'job_scheduled'
  | 'review_requested'
  | 'voice_call_received'
  | 'voice_call_lead_captured'
  | 'voice_call_transferred'

export interface ActivityEvent {
  id: string
  user_id: string
  quote_id: string | null
  invoice_id: string | null
  event_type: ActivityEventType
  metadata: Record<string, unknown>
  created_at: string
}

// ─── Notifications ──────────────────────────────────────────

export type NotificationType = 'quote_viewed' | 'quote_accepted' | 'customer_replied' | 'invoice_paid' | 'review_requested' | 'voice_call_lead' | 'voice_call_missed'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  link_url: string
  is_read: boolean
  read_at: string | null
  metadata: Record<string, unknown>
  created_at: string
}

// ─── Jobs ───────────────────────────────────────────────────

export type JobStatus = 'scheduled' | 'in_progress' | 'completed'

export interface Job {
  id: string
  user_id: string
  quote_id: string | null
  customer_id: string
  job_type: string
  status: JobStatus
  scheduled_date: string
  start_time: string | null
  estimated_hours: number
  actual_hours: number | null
  notes: string | null
  address: string | null
  voice_call_id: string | null
  created_at: string
  updated_at: string
  customer?: Customer
  quote?: Quote
  voice_call?: VoiceCall
}

// ─── Voice Calls ─────────────────────────────────────────────

export interface VoiceCall {
  id: string
  user_id: string
  vapi_call_id: string
  caller_number: string | null
  duration_seconds: number
  duration_minutes: number
  status: string
  summary: string | null
  transcript: Record<string, unknown>[] | null
  recording_url: string | null
  customer_id: string | null
  lead_captured: boolean
  transferred: boolean
  ended_reason: string | null
  appointment_set: boolean
  metadata: Record<string, unknown>
  created_at: string
  ended_at: string | null
  customer?: Customer
}
