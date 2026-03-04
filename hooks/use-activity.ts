'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ActivityEvent } from '@/lib/types'

export function useActivity(limit = 20) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from('activity_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (data) setEvents(data)
    setLoading(false)
  }, [supabase, limit])

  useEffect(() => {
    fetchEvents()

    // Real-time subscription — new events appear live
    const channel = supabase
      .channel('activity-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_events',
      }, (payload) => {
        setEvents(prev => [payload.new as ActivityEvent, ...prev].slice(0, limit))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, fetchEvents, limit])

  return { events, loading, refetch: fetchEvents }
}
