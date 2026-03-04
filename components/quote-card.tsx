'use client'

import { useRouter } from 'next/navigation'
import { RotateCw, Send, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, timeAgo, daysUntil } from '@/lib/format'
import type { Quote, QuoteStatus } from '@/lib/types'

const statusConfig: Record<QuoteStatus, { color: string; label: string; pulse?: boolean }> = {
  draft: { color: 'bg-sf-text-tertiary', label: 'Draft' },
  sent: { color: 'bg-sf-info', label: 'Sent' },
  viewed: { color: 'bg-sf-accent', label: 'Viewed', pulse: true },
  accepted: { color: 'bg-sf-success', label: 'Accepted' },
  expired: { color: 'bg-sf-danger', label: 'Expired' },
}

interface QuoteCardProps {
  quote: Quote
  onSendReminder: () => void
}

export function QuoteCard({ quote, onSendReminder }: QuoteCardProps) {
  const router = useRouter()
  const status = statusConfig[quote.status]
  const displayTime = quote.viewed_at || quote.sent_at || quote.created_at

  return (
    <div
      onClick={() => router.push(`/quotes/${quote.id}`)}
      className="group border border-sf-border rounded-[6px] bg-sf-surface-1 hover:bg-sf-surface-2 transition-colors duration-120 px-3 py-2.5 cursor-pointer">
      {/* Row 1: Status + Quote Number + Time */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'inline-block w-[8px] h-[8px] rounded-full shrink-0',
                status.color,
                status.pulse && 'animate-status-pulse'
              )}
            />
            <span className="text-[12px] font-medium text-sf-text-secondary">{status.label}</span>
          </div>
          <span className="text-sf-text-tertiary text-[11px]">&middot;</span>
          <span className="text-[12px] text-sf-text-tertiary font-mono">{quote.quote_number}</span>
        </div>
        <span className="text-[11px] text-sf-text-tertiary">{timeAgo(displayTime)}</span>
      </div>

      {/* Row 2: Customer + Job Type + Amount */}
      <div className="flex items-baseline justify-between mb-0.5">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-[14px] font-semibold text-sf-text-primary truncate">{quote.customer?.name ?? 'Unknown'}</span>
          <span className="text-sf-text-tertiary text-[11px]">&mdash;</span>
          <span className="text-[13px] text-sf-text-secondary truncate">{quote.job_type}</span>
        </div>
        <span className="font-mono text-[14px] font-medium text-sf-text-primary shrink-0 ml-3">
          {formatCurrency(Number(quote.total))}
        </span>
      </div>

      {/* Row 3: Address */}
      <div className="text-[12px] text-sf-text-secondary mb-2">{quote.customer?.address ?? ''}</div>

      {/* Row 4: Follow-up + Action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[12px] text-sf-text-tertiary">
          {quote.invoice && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-sf-success bg-sf-success/8 px-1.5 py-0.5 rounded-[3px]">
              <Receipt size={10} strokeWidth={1.5} />
              {quote.invoice.invoice_number}
              {quote.invoice.status === 'paid' ? ' · Paid' : quote.invoice.status === 'sent' ? ' · Sent' : ' · Draft'}
            </span>
          )}
          {!quote.invoice && quote.next_follow_up && (
            <>
              <RotateCw size={12} strokeWidth={1.5} />
              <span>Auto follow-up {daysUntil(quote.next_follow_up)}</span>
            </>
          )}
          {!quote.invoice && quote.status === 'accepted' && (
            <span className="text-sf-success">Accepted &mdash; ready to schedule</span>
          )}
          {quote.status === 'expired' && (
            <span className="text-sf-danger">Expired</span>
          )}
          {quote.status === 'draft' && (
            <span>Draft &mdash; not sent</span>
          )}
        </div>
        {(quote.status === 'sent' || quote.status === 'viewed') && (
          <button
            onClick={(e) => { e.stopPropagation(); onSendReminder() }}
            className="btn-press flex items-center gap-1 h-6 px-2 rounded-[4px] text-[11px] font-medium text-sf-text-secondary border border-sf-border hover:bg-sf-surface-2 hover:text-sf-text-primary transition-colors duration-120"
          >
            <Send size={11} strokeWidth={1.5} />
            Send Reminder
          </button>
        )}
        {quote.status === 'draft' && (
          <button
            onClick={(e) => { e.stopPropagation(); onSendReminder() }}
            className="btn-press flex items-center gap-1 h-6 px-2 rounded-[4px] text-[11px] font-medium text-sf-accent border border-sf-accent/30 hover:bg-sf-accent/10 transition-colors duration-120"
          >
            <Send size={11} strokeWidth={1.5} />
            Send Quote
          </button>
        )}
      </div>
    </div>
  )
}
