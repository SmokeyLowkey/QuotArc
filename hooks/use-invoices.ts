'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Invoice } from '@/lib/types'
import type { PaginationMeta } from '@/lib/pagination'

interface InvoiceStats {
  outstanding: number
  overdue: number
  overdueCount: number
  collectedThisMonth: number
}

const DEFAULT_LIMIT = 20

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [stats, setStats] = useState<InvoiceStats>({ outstanding: 0, overdue: 0, overdueCount: 0, collectedThisMonth: 0 })

  const fetchInvoices = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(DEFAULT_LIMIT) })
      const res = await fetch(`/api/invoices?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setInvoices(data.invoices)
      setStats(data.stats)
      setPagination(data.pagination)
    } catch (err) {
      console.error('Failed to fetch invoices:', err)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  const createInvoice = useCallback(async (data: {
    customer_id: string
    quote_id?: string
    due_date?: string
    line_items?: Array<{
      description: string
      category?: string
      quantity: number
      unit?: string
      rate: number
    }>
  }): Promise<Invoice | null> => {
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) return null
      const invoice = await res.json()
      await fetchInvoices()
      return invoice
    } catch (err) {
      console.error('Failed to create invoice:', err)
      return null
    }
  }, [fetchInvoices])

  const updateInvoice = useCallback(async (id: string, data: {
    line_items?: Array<{
      description: string
      category?: string
      quantity: number
      unit?: string
      rate: number
    }>
    due_date?: string
    status?: string
    tax_rate?: number
  }): Promise<Invoice | null> => {
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) return null
      const updated = await res.json()
      setInvoices(prev => prev.map(inv => inv.id === id ? updated : inv))
      return updated
    } catch (err) {
      console.error('Failed to update invoice:', err)
      return null
    }
  }, [])

  const sendInvoice = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/invoices/${id}/send`, { method: 'POST' })
      if (!res.ok) return false
      const updated = await res.json()
      setInvoices(prev => prev.map(inv => inv.id === id ? updated : inv))
      return true
    } catch (err) {
      console.error('Failed to send invoice:', err)
      return false
    }
  }, [])

  const deleteInvoice = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
      if (!res.ok) return false
      setInvoices(prev => prev.filter(inv => inv.id !== id))
      return true
    } catch (err) {
      console.error('Failed to delete invoice:', err)
      return false
    }
  }, [])

  return {
    invoices,
    loading,
    stats,
    page,
    setPage,
    pagination,
    createInvoice,
    updateInvoice,
    sendInvoice,
    deleteInvoice,
    refetch: fetchInvoices,
  }
}
