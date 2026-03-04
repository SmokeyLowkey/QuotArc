'use client'

import Link from 'next/link'
import { Send, AlertTriangle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useInvoices } from '@/hooks/use-invoices'
import { formatCurrency, formatDate } from '@/lib/format'
import { PageHeader } from '@/components/page-header'
import { MetricStrip } from '@/components/metric-strip'
import { PaginationControls } from '@/components/ui/pagination-controls'
import type { InvoiceStatus } from '@/lib/types'
import { toast } from 'sonner'

const statusConfig: Record<InvoiceStatus, { color: string; label: string }> = {
  draft: { color: 'bg-sf-text-tertiary', label: 'Draft' },
  sent: { color: 'bg-sf-info', label: 'Sent' },
  paid: { color: 'bg-sf-success', label: 'Paid' },
  overdue: { color: 'bg-sf-danger', label: 'Overdue' },
}

export default function InvoicesPage() {
  const { invoices, sendInvoice, stats, loading, page, setPage, pagination } = useInvoices()

  const overdueInvoices = invoices.filter(i => i.status === 'overdue')

  const handleSend = async (id: string) => {
    const ok = await sendInvoice(id)
    if (ok) toast.success('Invoice sent')
    else toast.error('Failed to send')
  }

  const metricItems = [
    { label: 'Outstanding', value: formatCurrency(stats.outstanding) },
    { label: 'Overdue', value: `${formatCurrency(stats.overdue)} (${stats.overdueCount})`, variant: 'danger' as const },
    { label: 'Collected this month', value: formatCurrency(stats.collectedThisMonth), variant: 'success' as const },
  ]

  if (loading) {
    return (
      <div className="px-4 md:px-6 py-6">
        <div className="text-sf-text-tertiary text-[13px]">Loading invoices...</div>
      </div>
    )
  }

  return (
    <div className="px-4 md:px-6 py-4 md:py-6">
      <PageHeader
        title="Invoices"
        actions={
          overdueInvoices.length > 0 ? (
            <button
              onClick={() => {
                overdueInvoices.forEach(inv => sendInvoice(inv.id))
                toast.success(`Reminders sent to ${overdueInvoices.length} customer${overdueInvoices.length !== 1 ? 's' : ''}`)
              }}
              className="btn-press inline-flex items-center gap-1.5 h-8 px-3 border border-sf-border rounded-[4px] text-[12px] sm:text-[13px] font-medium text-sf-danger hover:bg-sf-surface-2 transition-colors duration-120"
            >
              <AlertTriangle size={14} strokeWidth={1.5} />
              <span className="hidden sm:inline">Send All Overdue Reminders</span>
              <span className="sm:hidden">Send Overdue</span>
            </button>
          ) : null
        }
      />

      <MetricStrip items={metricItems} />

      {invoices.length === 0 ? (
        <div className="text-center py-12 text-sf-text-tertiary text-[13px]">
          No invoices yet. Create one from an accepted quote.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block border border-sf-border rounded-[6px] overflow-hidden">
            <div className="grid grid-cols-[80px_1fr_110px_90px_90px_90px] gap-2 px-3 py-1.5 bg-sf-surface-2 text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary">
              <span>#</span>
              <span>Customer</span>
              <span className="text-right">Amount</span>
              <span>Status</span>
              <span>Sent</span>
              <span className="text-right">Action</span>
            </div>
            {invoices.map(inv => (
              <div key={inv.id} className="grid grid-cols-[80px_1fr_110px_90px_90px_90px] gap-2 px-3 py-2 border-t border-sf-border items-center hover:bg-sf-surface-2 transition-colors duration-120">
                <Link href={`/invoices/${inv.id}`} className="text-[12px] font-mono text-sf-accent hover:underline">
                  {inv.invoice_number}
                </Link>
                <Link href={`/invoices/${inv.id}`} className="text-[13px] text-sf-text-primary truncate hover:underline">
                  {inv.customer?.name || 'Unknown'}
                </Link>
                <span className="text-[13px] font-mono text-sf-text-primary text-right">{formatCurrency(inv.total)}</span>
                <span className="flex items-center gap-1.5">
                  <span className={cn('inline-block w-[6px] h-[6px] rounded-full', statusConfig[inv.status].color)} />
                  <span className="text-[12px] text-sf-text-secondary">{statusConfig[inv.status].label}</span>
                </span>
                <span className="text-[12px] text-sf-text-tertiary">{inv.sent_at ? formatDate(inv.sent_at) : '—'}</span>
                <span className="text-right">
                  {inv.status === 'draft' && (
                    <button
                      onClick={() => handleSend(inv.id)}
                      className="btn-press inline-flex items-center gap-1 h-6 px-2 rounded-[4px] text-[11px] font-medium text-sf-accent border border-sf-accent/30 hover:bg-sf-accent/10 transition-colors duration-120"
                    >
                      <Send size={12} strokeWidth={1.5} />
                      Send
                    </button>
                  )}
                  {inv.status === 'paid' && (
                    <span className="text-[11px] text-sf-text-tertiary">—</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* Mobile cards — enhanced */}
          <div className="md:hidden flex flex-col gap-2">
            {invoices.map(inv => (
              <div key={inv.id} className="border border-sf-border rounded-[6px] bg-sf-surface-1 px-3 py-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={cn('inline-block w-[6px] h-[6px] rounded-full shrink-0', statusConfig[inv.status].color)} />
                    <span className="text-[12px] text-sf-text-secondary">{statusConfig[inv.status].label}</span>
                    <span className="text-[11px] text-sf-text-tertiary font-mono">{inv.invoice_number}</span>
                  </div>
                  <Link href={`/invoices/${inv.id}`}>
                    <ChevronRight size={14} strokeWidth={1.5} className="text-sf-text-tertiary" />
                  </Link>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <Link href={`/invoices/${inv.id}`} className="text-[14px] font-semibold text-sf-text-primary hover:underline block">
                      {inv.customer?.name || 'Unknown'}
                    </Link>
                    {inv.due_date && (
                      <div className="text-[11px] text-sf-text-tertiary mt-0.5">
                        Due {formatDate(inv.due_date)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[14px] font-medium text-sf-text-primary">{formatCurrency(inv.total)}</span>
                    {inv.status === 'draft' && (
                      <button
                        onClick={() => handleSend(inv.id)}
                        className="btn-press inline-flex items-center gap-1 h-7 px-2.5 rounded-[4px] text-[11px] font-medium text-sf-accent border border-sf-accent/30 hover:bg-sf-accent/10 transition-colors"
                      >
                        <Send size={11} strokeWidth={1.5} />
                        Send
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <PaginationControls page={page} totalPages={pagination.totalPages} onPageChange={setPage} className="mt-4" />
          )}
        </>
      )}
    </div>
  )
}
