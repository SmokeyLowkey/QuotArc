'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Quote, QuoteStatus } from '@/lib/types'
import type { PaginationMeta } from '@/lib/pagination'

interface QuoteStats {
  sentThisMonth: number
  viewed: number
  viewedRate: number
  accepted: number
  acceptedRate: number
  revenueWon: number
}

const DEFAULT_LIMIT = 20

export function useQuotes() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilterRaw] = useState<QuoteStatus | 'all'>('all')
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [stats, setStats] = useState<QuoteStats>({
    sentThisMonth: 0, viewed: 0, viewedRate: 0, accepted: 0, acceptedRate: 0, revenueWon: 0,
  })
  const supabase = createClient()

  const setStatusFilter = useCallback((status: QuoteStatus | 'all') => {
    setStatusFilterRaw(status)
    setPage(1)
  }, [])

  const fetchQuotes = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(DEFAULT_LIMIT) })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/quotes?${params}`)
      if (res.ok) {
        const data = await res.json()
        setQuotes(data.quotes as Quote[])
        setStats(data.stats)
        setPagination(data.pagination)
      }
    } catch {
      // Silently fail
    }
    setLoading(false)
  }, [page, statusFilter])

  useEffect(() => {
    fetchQuotes()

    // Real-time subscription for status updates
    const channel = supabase
      .channel('quotes-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'quotes',
      }, () => {
        fetchQuotes()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, fetchQuotes])

  const sendQuote = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await fetch('/api/quotes/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId: id }),
    })

    if (res.ok) {
      setQuotes(prev => prev.map(q => q.id === id ? {
        ...q,
        status: 'sent' as QuoteStatus,
        sent_at: new Date().toISOString(),
      } : q))
      return { ok: true }
    }

    const data = await res.json().catch(() => ({ error: 'Send failed' }))
    return { ok: false, error: data.error }
  }, [])

  return { quotes, loading, page, setPage, statusFilter, setStatusFilter, pagination, stats, sendQuote, refetch: fetchQuotes }
}
