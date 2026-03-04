'use client'

import { Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import type { InvoiceStatus } from '@/lib/types'

const statusConfig: Record<InvoiceStatus, { color: string; label: string }> = {
  draft: { color: 'bg-sf-text-tertiary', label: 'Draft' },
  sent: { color: 'bg-sf-info', label: 'Sent' },
  paid: { color: 'bg-sf-success', label: 'Paid' },
  overdue: { color: 'bg-sf-danger', label: 'Overdue' },
}

interface RichInvoiceCardProps {
  invoiceNumber: string
  total: number
  status: InvoiceStatus
  /** Link to view the invoice — owner only */
  href?: string
}

export function RichInvoiceCard({ invoiceNumber, total, status, href }: RichInvoiceCardProps) {
  const s = statusConfig[status] || statusConfig.draft

  const content = (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-[8px] border border-sf-border bg-sf-surface-1 hover:bg-sf-surface-2 transition-colors">
      <div className="w-9 h-9 rounded-[6px] bg-sf-success/10 flex items-center justify-center shrink-0">
        <Receipt size={18} className="text-sf-success" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium text-sf-text-primary font-mono">{invoiceNumber}</span>
          <span className="text-sf-text-tertiary text-[11px]">&middot;</span>
          <span className="text-[12px] text-sf-text-secondary">Invoice</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[14px] font-semibold text-sf-success font-mono">{formatCurrency(total)}</span>
          <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider')}>
            <span className={cn('w-[6px] h-[6px] rounded-full', s.color)} />
            {s.label}
          </span>
        </div>
      </div>
    </div>
  )

  if (href) {
    return <a href={href} className="block no-underline">{content}</a>
  }

  return content
}
