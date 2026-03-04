'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Send,
  Save,
  GripVertical,
} from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Invoice, InvoiceLineItem, InvoiceStatus, LineItemCategory } from '@/lib/types'

const statusConfig: Record<InvoiceStatus, { color: string; label: string }> = {
  draft: { color: 'bg-sf-text-tertiary', label: 'Draft' },
  sent: { color: 'bg-sf-info', label: 'Sent' },
  paid: { color: 'bg-sf-success', label: 'Paid' },
  overdue: { color: 'bg-sf-danger', label: 'Overdue' },
}

interface EditableLineItem {
  id: string
  description: string
  category: LineItemCategory
  quantity: number
  unit: string
  rate: number
}

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  // Editable state
  const [lineItems, setLineItems] = useState<EditableLineItem[]>([])
  const [dueDate, setDueDate] = useState('')
  const [taxRate, setTaxRate] = useState(0.05)
  const [dirty, setDirty] = useState(false)

  const fetchInvoice = useCallback(async () => {
    try {
      const res = await fetch(`/api/invoices/${id}`)
      if (!res.ok) return
      const data = await res.json()
      setInvoice(data)
      setLineItems(
        (data.line_items || []).map((li: InvoiceLineItem) => ({
          id: li.id,
          description: li.description,
          category: li.category,
          quantity: li.quantity,
          unit: li.unit,
          rate: li.rate,
        }))
      )
      setDueDate(data.due_date ? data.due_date.split('T')[0] : '')
      setTaxRate(data.tax_rate)
    } catch (err) {
      console.error('Failed to fetch invoice:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchInvoice()
  }, [fetchInvoice])

  // Computed totals
  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.rate, 0)
  const tax = Math.round(subtotal * taxRate * 100) / 100
  const total = subtotal + tax

  const updateLineItem = (index: number, field: keyof EditableLineItem, value: string | number) => {
    setLineItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
    setDirty(true)
  }

  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        description: '',
        category: 'material' as LineItemCategory,
        quantity: 1,
        unit: 'ea',
        rate: 0,
      },
    ])
    setDirty(true)
  }

  const removeLineItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index))
    setDirty(true)
  }

  const handleSave = async () => {
    if (!invoice) return
    setSaving(true)
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          due_date: dueDate || undefined,
          tax_rate: taxRate,
          line_items: lineItems.map(li => ({
            description: li.description,
            category: li.category,
            quantity: li.quantity,
            unit: li.unit,
            rate: li.rate,
          })),
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setInvoice(updated)
        setDirty(false)
        toast.success('Invoice saved')
      } else {
        toast.error('Failed to save invoice')
      }
    } catch {
      toast.error('Failed to save invoice')
    } finally {
      setSaving(false)
    }
  }

  const handleSend = async () => {
    if (!invoice) return
    // Save first if dirty
    if (dirty) await handleSave()
    setSending(true)
    try {
      const res = await fetch(`/api/invoices/${id}/send`, { method: 'POST' })
      if (res.ok) {
        const updated = await res.json()
        setInvoice(updated)
        toast.success('Invoice sent')
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to send invoice')
      }
    } catch {
      toast.error('Failed to send invoice')
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this invoice?')) return
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Invoice deleted')
        router.push('/invoices')
      }
    } catch {
      toast.error('Failed to delete')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sf-text-tertiary text-[13px]">Loading...</div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="px-4 md:px-6 py-6">
        <p className="text-sf-text-secondary text-[13px]">Invoice not found.</p>
        <Link href="/invoices" className="text-sf-accent text-[13px] hover:underline mt-2 inline-block">
          Back to Invoices
        </Link>
      </div>
    )
  }

  const status = statusConfig[invoice.status]
  const isDraft = invoice.status === 'draft'
  const quoteRef = (invoice as unknown as Record<string, unknown>).quote as { id: string; quote_number: string; job_type: string } | null

  return (
    <div className="px-4 md:px-6 py-4 md:py-6">
      {/* Header */}
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1 text-[12px] text-sf-text-tertiary hover:text-sf-text-secondary transition-colors mb-2"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        Back to Invoices
      </Link>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={cn('inline-block w-[8px] h-[8px] rounded-full', status.color)} />
            <span className="text-[12px] font-medium text-sf-text-secondary">{status.label}</span>
          </div>
          <span className="font-mono text-[14px] font-medium text-sf-text-primary">{invoice.invoice_number}</span>
          <span className="font-mono text-[14px] font-medium text-sf-accent">{formatCurrency(total)}</span>
        </div>
        <div className="flex items-center gap-2">
          {isDraft && (
            <>
              <button
                onClick={handleSave}
                disabled={saving || !dirty}
                className="btn-press inline-flex items-center gap-1.5 h-8 px-3 border border-sf-border text-sf-text-secondary hover:bg-sf-surface-2 text-[13px] font-medium rounded-[4px] transition-colors duration-120 disabled:opacity-40"
              >
                <Save size={14} strokeWidth={2} />
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleSend}
                disabled={sending || lineItems.length === 0}
                className="btn-press inline-flex items-center gap-1.5 h-8 px-3 bg-sf-accent hover:bg-sf-accent-hover text-white text-[13px] font-medium rounded-[4px] transition-colors duration-120 disabled:opacity-40"
              >
                <Send size={14} strokeWidth={2} />
                {sending ? 'Sending...' : 'Send Invoice'}
              </button>
              <button
                onClick={handleDelete}
                className="btn-press inline-flex items-center gap-1.5 h-8 px-3 border border-sf-danger/30 text-sf-danger hover:bg-sf-danger/10 text-[13px] font-medium rounded-[4px] transition-colors duration-120"
              >
                <Trash2 size={14} strokeWidth={2} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Customer & Quote Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-sf-text-tertiary mb-1">Customer</div>
          <div className="text-[13px] text-sf-text-primary font-medium">{invoice.customer?.name}</div>
          {invoice.customer?.email && (
            <div className="text-[12px] text-sf-text-secondary">{invoice.customer.email}</div>
          )}
          {invoice.customer?.phone && (
            <div className="text-[12px] text-sf-text-secondary">{invoice.customer.phone}</div>
          )}
        </div>
        {quoteRef && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-sf-text-tertiary mb-1">From Quote</div>
            <Link href={`/quotes/${quoteRef.id}`} className="text-[13px] text-sf-accent hover:underline">
              {quoteRef.quote_number} — {quoteRef.job_type}
            </Link>
          </div>
        )}
        <div>
          <div className="text-[11px] uppercase tracking-wider text-sf-text-tertiary mb-1">Due Date</div>
          {isDraft ? (
            <input
              type="date"
              value={dueDate}
              onChange={e => { setDueDate(e.target.value); setDirty(true) }}
              className="h-8 px-2 border border-sf-border rounded-[4px] text-[13px] text-sf-text-primary bg-sf-surface-1"
            />
          ) : (
            <div className="text-[13px] text-sf-text-primary">
              {dueDate ? new Date(dueDate + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
            </div>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="border border-sf-border rounded-[6px] overflow-hidden mb-4">
        {/* Header */}
        <div className={cn(
          'grid gap-2 px-3 py-2 bg-sf-surface-2 text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary',
          isDraft
            ? 'grid-cols-[24px_1fr_90px_60px_70px_80px_90px_32px]'
            : 'grid-cols-[1fr_90px_60px_70px_80px_90px]'
        )}>
          {isDraft && <span />}
          <span>Description</span>
          <span>Category</span>
          <span className="text-right">Qty</span>
          <span>Unit</span>
          <span className="text-right">Rate</span>
          <span className="text-right">Total</span>
          {isDraft && <span />}
        </div>

        {/* Rows */}
        {lineItems.map((li, index) => (
          <div
            key={li.id}
            className={cn(
              'grid gap-2 px-3 py-1.5 border-t border-sf-border items-center',
              isDraft
                ? 'grid-cols-[24px_1fr_90px_60px_70px_80px_90px_32px]'
                : 'grid-cols-[1fr_90px_60px_70px_80px_90px]'
            )}
          >
            {isDraft && (
              <GripVertical size={14} className="text-sf-text-tertiary cursor-grab" />
            )}
            {isDraft ? (
              <input
                value={li.description}
                onChange={e => updateLineItem(index, 'description', e.target.value)}
                placeholder="Description"
                className="h-7 px-2 border border-sf-border rounded-[4px] text-[13px] text-sf-text-primary bg-sf-surface-1 w-full"
              />
            ) : (
              <span className="text-[13px] text-sf-text-primary">{li.description}</span>
            )}
            {isDraft ? (
              <select
                value={li.category}
                onChange={e => updateLineItem(index, 'category', e.target.value)}
                className="h-7 px-1 border border-sf-border rounded-[4px] text-[12px] text-sf-text-secondary bg-sf-surface-1"
              >
                <option value="material">Material</option>
                <option value="labor">Labor</option>
                <option value="permit">Permit</option>
                <option value="other">Other</option>
              </select>
            ) : (
              <span className="text-[12px] text-sf-text-tertiary capitalize">{li.category}</span>
            )}
            {isDraft ? (
              <input
                type="number"
                min="0"
                step="0.01"
                value={li.quantity}
                onChange={e => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                className="h-7 px-2 border border-sf-border rounded-[4px] text-[13px] text-sf-text-primary bg-sf-surface-1 text-right font-mono w-full"
              />
            ) : (
              <span className="text-[13px] font-mono text-sf-text-secondary text-right">{li.quantity}</span>
            )}
            {isDraft ? (
              <input
                value={li.unit}
                onChange={e => updateLineItem(index, 'unit', e.target.value)}
                className="h-7 px-2 border border-sf-border rounded-[4px] text-[12px] text-sf-text-secondary bg-sf-surface-1 w-full"
              />
            ) : (
              <span className="text-[12px] text-sf-text-tertiary">{li.unit}</span>
            )}
            {isDraft ? (
              <input
                type="number"
                min="0"
                step="0.01"
                value={li.rate}
                onChange={e => updateLineItem(index, 'rate', parseFloat(e.target.value) || 0)}
                className="h-7 px-2 border border-sf-border rounded-[4px] text-[13px] text-sf-text-primary bg-sf-surface-1 text-right font-mono w-full"
              />
            ) : (
              <span className="text-[13px] font-mono text-sf-text-secondary text-right">{formatCurrency(li.rate)}</span>
            )}
            <span className="text-[13px] font-mono font-medium text-sf-text-primary text-right">
              {formatCurrency(li.quantity * li.rate)}
            </span>
            {isDraft && (
              <button
                onClick={() => removeLineItem(index)}
                className="flex items-center justify-center h-7 w-7 rounded-[4px] text-sf-text-tertiary hover:text-sf-danger hover:bg-sf-danger/10 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}

        {/* Add Line Item */}
        {isDraft && (
          <button
            onClick={addLineItem}
            className="w-full flex items-center gap-1.5 px-3 py-2 border-t border-sf-border text-[13px] text-sf-accent hover:bg-sf-surface-2 transition-colors"
          >
            <Plus size={14} strokeWidth={2} />
            Add Line Item
          </button>
        )}
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-6">
        <div className="w-56 space-y-1.5">
          <div className="flex justify-between text-[13px] text-sf-text-secondary">
            <span>Subtotal</span>
            <span className="font-mono">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-[13px] text-sf-text-secondary items-center">
            <span className="flex items-center gap-1.5">
              Tax
              {isDraft ? (
                <span className="inline-flex items-center">
                  (
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={Math.round(taxRate * 100)}
                    onChange={e => { setTaxRate(parseFloat(e.target.value) / 100 || 0); setDirty(true) }}
                    className="w-10 h-5 px-1 border border-sf-border rounded-[3px] text-[12px] text-center font-mono bg-sf-surface-1"
                  />
                  %)
                </span>
              ) : (
                <span>({(taxRate * 100).toFixed(0)}%)</span>
              )}
            </span>
            <span className="font-mono">{formatCurrency(tax)}</span>
          </div>
          <div className="flex justify-between text-[15px] font-bold text-sf-text-primary border-t border-sf-border pt-1.5">
            <span>Total</span>
            <span className="font-mono">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {/* Status info */}
      {invoice.status === 'paid' && invoice.paid_at && (
        <div className="p-3 bg-sf-success/10 border border-sf-success/20 rounded-[6px] text-[13px] text-sf-success font-medium">
          Paid on {new Date(invoice.paid_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      )}
      {invoice.status === 'overdue' && (
        <div className="p-3 bg-sf-danger/10 border border-sf-danger/20 rounded-[6px] text-[13px] text-sf-danger font-medium">
          Payment overdue — was due {dueDate ? new Date(dueDate + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '—'}
        </div>
      )}
      {invoice.status === 'sent' && (
        <div className="p-3 bg-sf-info/10 border border-sf-info/20 rounded-[6px] text-[13px] text-sf-info font-medium">
          Sent on {invoice.sent_at ? new Date(invoice.sent_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
        </div>
      )}
    </div>
  )
}
