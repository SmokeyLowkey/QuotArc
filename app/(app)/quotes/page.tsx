'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useQuotes } from '@/hooks/use-quotes'
import { QuoteCard } from '@/components/quote-card'
import { PageHeader } from '@/components/page-header'
import { MetricStrip } from '@/components/metric-strip'
import { FilterSidebar } from '@/components/filter-sidebar'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { toast } from 'sonner'
import type { QuoteStatus } from '@/lib/types'

const FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'sent', label: 'Sent' },
  { id: 'viewed', label: 'Viewed' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'expired', label: 'Expired' },
]

export default function QuotesPage() {
  const { quotes, stats, pagination, page, setPage, statusFilter, setStatusFilter, sendQuote } = useQuotes()

  const metricItems = [
    { label: 'Sent this month', value: stats.sentThisMonth.toString() },
    { label: 'Viewed', value: `${stats.viewed} (${stats.viewedRate}%)` },
    { label: 'Accepted', value: `${stats.accepted} (${stats.acceptedRate}%)` },
    { label: 'Revenue won', value: `$${stats.revenueWon.toLocaleString()}`, variant: 'accent' as const },
  ]

  // Show current filter's total count in sidebar
  const counts: Record<string, number> = {}
  if (pagination) counts[statusFilter] = pagination.total

  return (
    <div className="px-4 md:px-6 py-4 md:py-6">
      <PageHeader
        title="Quotes"
        actions={
          <Link
            href="/quotes/new"
            className="btn-press inline-flex items-center gap-1.5 h-8 px-3 bg-sf-accent hover:bg-sf-accent-hover text-white text-[13px] font-medium rounded-[4px] transition-colors duration-120"
          >
            <Plus size={14} strokeWidth={2} />
            New Quote
          </Link>
        }
      />

      <MetricStrip items={metricItems} />

      {/* Body: filter sidebar (desktop) + quote list */}
      <div className="flex gap-4">
        {/* Desktop filter sidebar */}
        <FilterSidebar
          filters={FILTER_OPTIONS}
          activeFilter={statusFilter}
          onFilterChange={(id) => setStatusFilter(id as QuoteStatus | 'all')}
          counts={counts}
        />

        {/* Quote list column */}
        <div className="flex-1 min-w-0">
          {/* Mobile filter chips */}
          <div className="lg:hidden flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
            {FILTER_OPTIONS.map(f => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id as QuoteStatus | 'all')}
                className={`btn-press shrink-0 h-7 px-2.5 rounded-[4px] text-[12px] font-medium transition-colors duration-120 ${
                  statusFilter === f.id
                    ? 'bg-sf-accent/10 text-sf-accent'
                    : 'text-sf-text-secondary hover:bg-sf-surface-2 hover:text-sf-text-primary'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {quotes.length === 0 ? (
            <p className="text-sf-text-tertiary text-[13px] py-8">
              {'No quotes yet. '}
              <Link href="/quotes/new" className="text-sf-accent hover:underline">
                Send your first one
              </Link>
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {quotes.map(quote => (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  onSendReminder={async () => {
                    const result = await sendQuote(quote.id)
                    if (!result.ok) toast.error(result.error || 'Failed to send quote')
                  }}
                />
              ))}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <PaginationControls page={page} totalPages={pagination.totalPages} onPageChange={setPage} className="mt-4" />
          )}
        </div>
      </div>
    </div>
  )
}
