'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { VoiceCall } from '@/lib/types'
import type { PaginationMeta } from '@/lib/pagination'

export type LeadFilter = 'all' | 'appointment_set' | 'needs_follow_up' | 'no_lead'

interface EnrichedVoiceCall extends Omit<VoiceCall, 'customer'> {
  customer: { id: string; name: string; phone: string | null } | null
  job_id: string | null
}

const POLL_INTERVAL = 30_000 // 30s — refetch from our DB
const SYNC_INTERVAL = 60_000 // 60s — backfill from Vapi API
const DEFAULT_LIMIT = 20

export function useVoiceCalls(initialFilter: LeadFilter = 'all') {
  const [calls, setCalls] = useState<EnrichedVoiceCall[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilterRaw] = useState<LeadFilter>(initialFilter)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const supabase = createClient()
  const lastSyncRef = useRef(0)

  const setFilter = useCallback((f: LeadFilter) => {
    setFilterRaw(f)
    setPage(1)
  }, [])

  const fetchCalls = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(DEFAULT_LIMIT) })
      if (filter !== 'all') params.set('filter', filter)
      const res = await fetch(`/api/voice/calls?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCalls(data.calls)
        setPagination(data.pagination)
      }
    } catch {
      // Silently fail
    }
    setLoading(false)
  }, [filter, page])

  // Backfill calls from Vapi API that webhooks may have missed
  const syncFromVapi = useCallback(async () => {
    const now = Date.now()
    if (now - lastSyncRef.current < SYNC_INTERVAL) return
    lastSyncRef.current = now

    try {
      const res = await fetch('/api/voice/sync', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.synced > 0) {
          await fetchCalls()
        }
      }
    } catch {
      // Silently fail
    }
  }, [fetchCalls])

  useEffect(() => {
    // Initial fetch + sync from Vapi
    fetchCalls()
    syncFromVapi()

    // Poll our DB every 30s
    const pollTimer = setInterval(fetchCalls, POLL_INTERVAL)

    // Sync from Vapi API every 60s
    const syncTimer = setInterval(syncFromVapi, SYNC_INTERVAL)

    // Supabase realtime (fires instantly when webhook works)
    const channel = supabase
      .channel('voice-calls-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'voice_calls',
      }, () => {
        fetchCalls()
      })
      .subscribe()

    return () => {
      clearInterval(pollTimer)
      clearInterval(syncTimer)
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchCalls, syncFromVapi])

  return { calls, loading, filter, setFilter, page, setPage, pagination, refetch: fetchCalls }
}
