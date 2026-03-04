'use client'

import { useState, useRef, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileText, MessageSquare, CalendarCheck, Receipt, ClipboardCheck, ShieldAlert, BookOpen } from 'lucide-react'
import { useQuoteDetail } from '@/hooks/use-quote-detail'
import { useUser } from '@/hooks/use-user'
import { useInvoices } from '@/hooks/use-invoices'
import { QuoteTimeline } from '@/components/quote-timeline'
import { MessageComposer } from '@/components/message-composer'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import { DEFAULT_TEMPLATES } from '@/components/quick-reply-bar'
import { ScheduleJobDialog } from '@/components/schedule-job-dialog'
import { toast } from 'sonner'
import type { Quote, QuoteStatus, QuickReplyTemplate, CodeNotes } from '@/lib/types'

const statusConfig: Record<QuoteStatus, { color: string; label: string }> = {
  draft: { color: 'bg-sf-text-tertiary', label: 'Draft' },
  sent: { color: 'bg-sf-info', label: 'Sent' },
  viewed: { color: 'bg-sf-accent', label: 'Viewed' },
  accepted: { color: 'bg-sf-success', label: 'Accepted' },
  expired: { color: 'bg-sf-danger', label: 'Expired' },
}

type Tab = 'quote' | 'communication'

export default function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { quote, messages, events, loading, sendMessage, markRead } = useQuoteDetail(id)
  const { profile } = useUser()
  const { createInvoice } = useInvoices()
  const [activeTab, setActiveTab] = useState<Tab>('communication')
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [creatingInvoice, setCreatingInvoice] = useState(false)
  const timelineEndRef = useRef<HTMLDivElement>(null)

  // Mark inbound messages as read when Communication tab is active
  useEffect(() => {
    if (activeTab === 'communication' && messages.some(m => m.direction === 'inbound' && !m.is_read)) {
      markRead()
    }
  }, [activeTab, messages, markRead])

  // Auto-scroll to bottom of timeline when messages change
  useEffect(() => {
    if (activeTab === 'communication') {
      timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, activeTab])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sf-text-tertiary text-[13px]">Loading...</div>
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="px-4 md:px-6 py-6">
        <p className="text-sf-text-secondary text-[13px]">Quote not found.</p>
        <Link href="/quotes" className="text-sf-accent text-[13px] hover:underline mt-2 inline-block">
          Back to Quotes
        </Link>
      </div>
    )
  }

  const status = statusConfig[quote.status]
  const unreadCount = messages.filter(m => m.direction === 'inbound' && !m.is_read).length

  // Templates: use user's custom templates if set, otherwise defaults
  const templates: QuickReplyTemplate[] =
    profile?.quick_reply_templates?.length
      ? profile.quick_reply_templates
      : DEFAULT_TEMPLATES

  const templateVars: Record<string, string> = {
    customer_name: quote.customer?.name || 'there',
    job_type: quote.job_type,
    company_name: profile?.company_name || '',
    quote_number: quote.quote_number,
  }

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 flex flex-col h-[calc(100dvh-56px)] md:h-[calc(100dvh-24px)]">
      {/* Header */}
      <div className="shrink-0">
        <Link
          href="/quotes"
          className="inline-flex items-center gap-1 text-[12px] text-sf-text-tertiary hover:text-sf-text-secondary transition-colors mb-2"
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          Back to Quotes
        </Link>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={cn('inline-block w-[8px] h-[8px] rounded-full', status.color)} />
              <span className="text-[12px] font-medium text-sf-text-secondary">{status.label}</span>
            </div>
            <span className="font-mono text-[14px] font-medium text-sf-text-primary">{quote.quote_number}</span>
            <span className="font-mono text-[14px] font-medium text-sf-accent">{formatCurrency(Number(quote.total))}</span>
          </div>
          {quote.status === 'accepted' && (
            <div className="flex items-center gap-2">
              {quote.jobs && quote.jobs.length > 0 ? (
                <Link
                  href="/jobs"
                  className="btn-press inline-flex items-center gap-1.5 h-8 px-3 border border-sf-success/30 text-sf-success hover:bg-sf-success/10 text-[13px] font-medium rounded-[4px] transition-colors duration-120"
                >
                  <CalendarCheck size={14} strokeWidth={2} />
                  Job Scheduled
                </Link>
              ) : (
                <button
                  onClick={() => setScheduleOpen(true)}
                  className="btn-press inline-flex items-center gap-1.5 h-8 px-3 bg-sf-accent hover:bg-sf-accent-hover text-white text-[13px] font-medium rounded-[4px] transition-colors duration-120"
                >
                  <CalendarCheck size={14} strokeWidth={2} />
                  Schedule Job
                </button>
              )}
              <button
                disabled={creatingInvoice}
                onClick={async () => {
                  setCreatingInvoice(true)
                  const inv = await createInvoice({
                    customer_id: quote.customer_id,
                    quote_id: quote.id,
                  })
                  setCreatingInvoice(false)
                  if (inv) {
                    toast.success('Invoice created from quote')
                    router.push(`/invoices/${inv.id}`)
                  } else {
                    toast.error('Failed to create invoice')
                  }
                }}
                className="btn-press inline-flex items-center gap-1.5 h-8 px-3 border border-sf-border text-sf-text-secondary hover:bg-sf-surface-2 text-[13px] font-medium rounded-[4px] transition-colors duration-120 disabled:opacity-50"
              >
                <Receipt size={14} strokeWidth={2} />
                {creatingInvoice ? 'Creating...' : 'Create Invoice'}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-[15px] font-semibold text-sf-text-primary">{quote.customer?.name ?? 'Unknown'}</span>
          <span className="text-sf-text-tertiary">&mdash;</span>
          <span className="text-[13px] text-sf-text-secondary">{quote.job_type}</span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-sf-border mb-0">
          <button
            onClick={() => setActiveTab('quote')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors duration-120 -mb-px',
              activeTab === 'quote'
                ? 'border-sf-accent text-sf-accent'
                : 'border-transparent text-sf-text-tertiary hover:text-sf-text-secondary'
            )}
          >
            <FileText size={14} strokeWidth={1.5} />
            Quote
          </button>
          <button
            onClick={() => setActiveTab('communication')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors duration-120 -mb-px',
              activeTab === 'communication'
                ? 'border-sf-accent text-sf-accent'
                : 'border-transparent text-sf-text-tertiary hover:text-sf-text-secondary'
            )}
          >
            <MessageSquare size={14} strokeWidth={1.5} />
            Communication
            {unreadCount > 0 && (
              <span className="ml-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-sf-accent text-white text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'quote' && (
        <div className="flex-1 overflow-y-auto py-4">
          <QuoteTab quote={quote} />
        </div>
      )}

      {activeTab === 'communication' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto py-3 px-1">
            <QuoteTimeline messages={messages} events={events} quoteId={id} />
            <div ref={timelineEndRef} />
          </div>
          <div className="shrink-0">
            <MessageComposer
              onSend={sendMessage}
              uploadUrl={`/api/upload?quoteId=${id}`}
              templates={templates}
              templateVars={templateVars}
            />
          </div>
        </div>
      )}

      {/* Schedule Job Dialog */}
      {quote.customer && (
        <ScheduleJobDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          quoteId={id}
          customerId={quote.customer_id}
          jobType={quote.job_type}
          customerName={quote.customer.name}
          address={quote.customer.address}
        />
      )}
    </div>
  )
}

function QuoteTab({ quote }: { quote: Quote }) {
  const lineItems = quote.line_items || []

  return (
    <div className="space-y-4">
      {/* Customer Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-sf-text-tertiary mb-1">Customer</div>
          <div className="text-[13px] text-sf-text-primary">{quote.customer?.name}</div>
          {quote.customer?.email && (
            <div className="text-[12px] text-sf-text-secondary">{quote.customer.email}</div>
          )}
          {quote.customer?.phone && (
            <div className="text-[12px] text-sf-text-secondary">{quote.customer.phone}</div>
          )}
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-sf-text-tertiary mb-1">Job Type</div>
          <div className="text-[13px] text-sf-text-primary">{quote.job_type}</div>
        </div>
      </div>

      {/* Scope Notes */}
      {quote.scope_notes && (
        <div className="p-3 bg-sf-surface-1 border border-sf-border rounded-[6px]">
          <div className="text-[11px] uppercase tracking-wider text-sf-text-tertiary mb-1">Scope</div>
          <div className="text-[13px] text-sf-text-secondary">{quote.scope_notes}</div>
        </div>
      )}

      {/* Code Notes */}
      {quote.code_notes && <CodeNotesDisplay notes={quote.code_notes} />}

      {/* Line Items */}
      <div className="border border-sf-border rounded-[6px] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-sf-surface-1 border-b border-sf-border">
              <th className="text-left py-2 px-3 text-[11px] uppercase tracking-wider text-sf-text-tertiary font-semibold">Description</th>
              <th className="text-right py-2 px-3 text-[11px] uppercase tracking-wider text-sf-text-tertiary font-semibold w-16">Qty</th>
              <th className="text-right py-2 px-3 text-[11px] uppercase tracking-wider text-sf-text-tertiary font-semibold w-20">Rate</th>
              <th className="text-right py-2 px-3 text-[11px] uppercase tracking-wider text-sf-text-tertiary font-semibold w-24">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => (
              <tr key={i} className="border-b border-sf-border last:border-0">
                <td className="py-2 px-3 text-sf-text-primary">
                  {item.description}
                  {item.category !== 'material' && (
                    <span className="ml-1.5 text-[10px] uppercase text-sf-text-tertiary">{item.category}</span>
                  )}
                </td>
                <td className="text-right py-2 px-3 font-mono text-sf-text-secondary">
                  {item.quantity} {item.unit !== 'ea' ? item.unit : ''}
                </td>
                <td className="text-right py-2 px-3 font-mono text-sf-text-secondary">{formatCurrency(item.rate)}</td>
                <td className="text-right py-2 px-3 font-mono font-medium text-sf-text-primary">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-48 space-y-1">
          <div className="flex justify-between text-[13px] text-sf-text-secondary">
            <span>Subtotal</span>
            <span className="font-mono">{formatCurrency(quote.subtotal)}</span>
          </div>
          <div className="flex justify-between text-[13px] text-sf-text-secondary">
            <span>Tax ({(quote.tax_rate * 100).toFixed(0)}%)</span>
            <span className="font-mono">{formatCurrency(quote.tax)}</span>
          </div>
          <div className="flex justify-between text-[15px] font-bold text-sf-text-primary border-t border-sf-border pt-1">
            <span>Total</span>
            <span className="font-mono">{formatCurrency(quote.total)}</span>
          </div>
        </div>
      </div>

      {/* Customer Note */}
      {quote.customer_note && (
        <div className="p-3 bg-sf-surface-1 border border-sf-border rounded-[6px]">
          <div className="text-[11px] uppercase tracking-wider text-sf-text-tertiary mb-1">Note to Customer</div>
          <div className="text-[13px] text-sf-text-secondary">{quote.customer_note}</div>
        </div>
      )}
    </div>
  )
}

function CodeNotesDisplay({ notes }: { notes: CodeNotes }) {
  const sections = [
    { key: 'inspection' as const, icon: ClipboardCheck, label: 'Inspection', color: 'text-sf-accent', bg: 'bg-sf-accent/5', border: 'border-sf-accent/20', dot: 'bg-sf-accent' },
    { key: 'safety' as const, icon: ShieldAlert, label: 'Safety', color: 'text-amber-600', bg: 'bg-amber-500/5', border: 'border-amber-500/20', dot: 'bg-amber-500' },
    { key: 'technical' as const, icon: BookOpen, label: 'Technical / NEC', color: 'text-sky-600', bg: 'bg-sky-500/5', border: 'border-sky-500/20', dot: 'bg-sky-500' },
  ] as const

  const hasNotes = sections.some(s => notes[s.key]?.length > 0)
  if (!hasNotes) return null

  return (
    <div className="flex flex-col gap-2">
      {sections.map(s => {
        const items = notes[s.key]
        if (!items?.length) return null
        return (
          <div key={s.key} className={cn(s.bg, 'border', s.border, 'rounded-[6px] px-3 py-2')}>
            <div className={cn('flex items-center gap-1.5 text-[11px] uppercase tracking-[0.05em] font-semibold mb-1', s.color)}>
              <s.icon size={12} strokeWidth={2} />
              {s.label}
            </div>
            <ul className="space-y-0.5">
              {items.map((note, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[12px] text-sf-text-secondary leading-relaxed">
                  <span className={cn('mt-[6px] w-1 h-1 rounded-full shrink-0', s.dot)} />
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
