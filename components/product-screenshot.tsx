'use client'

import { RotateCw } from 'lucide-react'
import { quotes as mockQuotes } from '@/lib/mock-data'
import { formatCurrency, timeAgo, daysUntil } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { QuoteStatus } from '@/lib/mock-data'

const statusConfig: Record<QuoteStatus, { color: string; label: string; pulse?: boolean }> = {
  draft: { color: 'bg-sf-text-tertiary', label: 'Draft' },
  sent: { color: 'bg-sf-info', label: 'Sent' },
  viewed: { color: 'bg-sf-accent', label: 'Viewed', pulse: true },
  accepted: { color: 'bg-sf-success', label: 'Accepted' },
  expired: { color: 'bg-sf-danger', label: 'Expired' },
}

// Render a real, self-contained version of the quotes list UI for use on the marketing page
export function ProductScreenshot() {
  const displayQuotes = mockQuotes.filter(q => q.status !== 'draft').slice(0, 5)
  const stats = {
    sent: 34,
    viewed: 28,
    viewedRate: 82,
    accepted: 11,
    acceptedRate: 32,
    revenue: 24340,
  }

  return (
    <div className="rounded-[6px] border border-sf-border bg-sf-surface-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
      {/* Fake browser chrome */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-sf-surface-1 border-b border-sf-border">
        <span className="w-[10px] h-[10px] rounded-full bg-[#c4473a]/60" />
        <span className="w-[10px] h-[10px] rounded-full bg-[#e07a2f]/40" />
        <span className="w-[10px] h-[10px] rounded-full bg-[#3d9a5f]/40" />
        <div className="flex-1 mx-4">
          <div className="mx-auto max-w-[260px] h-[22px] rounded-[4px] bg-sf-surface-2 flex items-center justify-center">
            <span className="text-[10px] text-sf-text-tertiary font-mono">app.quotarc.com/quotes</span>
          </div>
        </div>
      </div>

      {/* App content */}
      <div className="px-3 py-3 md:px-4 md:py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="font-heading text-[16px] font-semibold tracking-tight text-sf-text-primary">
            Quotes
          </span>
          <span className="inline-flex items-center gap-1 h-[28px] px-2.5 bg-sf-accent text-white text-[11px] font-medium rounded-[4px]">
            + New Quote
          </span>
        </div>

        {/* Metric strip */}
        <div className="flex items-baseline gap-3 md:gap-5 mb-3 py-1.5 border-b border-sf-border overflow-x-auto text-nowrap">
          <MiniMetric label="Sent" value={stats.sent.toString()} />
          <span className="text-sf-border text-[10px]">|</span>
          <MiniMetric label="Viewed" value={`${stats.viewed}`} sub={`(${stats.viewedRate}%)`} />
          <span className="text-sf-border text-[10px]">|</span>
          <MiniMetric label="Accepted" value={`${stats.accepted}`} sub={`(${stats.acceptedRate}%)`} />
          <span className="text-sf-border text-[10px]">|</span>
          <MiniMetric label="Won" value={`$${stats.revenue.toLocaleString()}`} highlight />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1 mb-3">
          {['All', 'Draft', 'Sent', 'Viewed', 'Accepted'].map((f, i) => (
            <span
              key={f}
              className={cn(
                'shrink-0 h-[22px] px-2 rounded-[4px] text-[10px] font-medium flex items-center',
                i === 0 ? 'bg-sf-accent/10 text-sf-accent' : 'text-sf-text-tertiary'
              )}
            >
              {f}
            </span>
          ))}
        </div>

        {/* Quote cards */}
        <div className="flex flex-col gap-1.5">
          {displayQuotes.map((quote) => {
            const status = statusConfig[quote.status]
            const displayTime = quote.viewedAt || quote.sentAt || quote.createdAt
            return (
              <div
                key={quote.id}
                className="border border-sf-border rounded-[4px] bg-sf-surface-1 px-2.5 py-2"
              >
                {/* Row 1 */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'inline-block w-[6px] h-[6px] rounded-full shrink-0',
                        status.color,
                        status.pulse && 'animate-status-pulse'
                      )}
                    />
                    <span className="text-[10px] font-medium text-sf-text-secondary">{status.label}</span>
                    <span className="text-sf-text-tertiary text-[9px]">&middot;</span>
                    <span className="text-[10px] text-sf-text-tertiary font-mono">{quote.number}</span>
                  </div>
                  <span className="text-[9px] text-sf-text-tertiary">{timeAgo(displayTime)}</span>
                </div>
                {/* Row 2 */}
                <div className="flex items-baseline justify-between mb-0.5">
                  <div className="flex items-baseline gap-1 min-w-0">
                    <span className="text-[12px] font-semibold text-sf-text-primary truncate">{quote.customerName}</span>
                    <span className="text-sf-text-tertiary text-[9px]">&mdash;</span>
                    <span className="text-[11px] text-sf-text-secondary truncate">{quote.jobType}</span>
                  </div>
                  <span className="font-mono text-[12px] font-medium text-sf-text-primary shrink-0 ml-2">
                    {formatCurrency(quote.total)}
                  </span>
                </div>
                {/* Row 3 */}
                <div className="text-[10px] text-sf-text-secondary mb-1">{quote.address}</div>
                {/* Row 4 */}
                {quote.nextFollowUp && (
                  <div className="flex items-center gap-1 text-[10px] text-sf-text-tertiary">
                    <RotateCw size={9} strokeWidth={1.5} />
                    <span>Auto follow-up {daysUntil(quote.nextFollowUp)}</span>
                  </div>
                )}
                {quote.status === 'accepted' && (
                  <div className="text-[10px] text-sf-success">Accepted &mdash; ready to schedule</div>
                )}
                {quote.status === 'expired' && (
                  <div className="text-[10px] text-sf-danger">Expired</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MiniMetric({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[9px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary">{label}:</span>
      <span className={cn('font-mono text-[11px] font-medium', highlight ? 'text-sf-accent' : 'text-sf-text-primary')}>
        {value}
      </span>
      {sub && <span className="text-[9px] text-sf-text-tertiary">{sub}</span>}
    </div>
  )
}
