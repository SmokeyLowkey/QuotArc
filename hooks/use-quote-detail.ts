'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Quote, QuoteMessage, ActivityEvent, Attachment } from '@/lib/types'

const POLL_INTERVAL = 3000

interface QuoteDetail {
  quote: Quote | null
  messages: QuoteMessage[]
  events: ActivityEvent[]
  loading: boolean
  sendMessage: (
    body: string,
    channel: 'portal' | 'note',
    attachments?: Attachment[],
    messageType?: string
  ) => Promise<boolean>
  markRead: () => Promise<void>
  refetch: () => Promise<void>
}

export function useQuoteDetail(quoteId: string): QuoteDetail {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [messages, setMessages] = useState<QuoteMessage[]>([])
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchQuote = useCallback(async () => {
    const res = await fetch(`/api/quotes/${quoteId}`)
    if (res.ok) {
      const data = await res.json()
      setQuote(data)
    }
  }, [quoteId])

  const fetchMessages = useCallback(async () => {
    const res = await fetch(`/api/quotes/${quoteId}/messages`)
    if (res.ok) {
      const data = await res.json()
      setMessages(data.messages)
      setEvents(data.events)
    }
  }, [quoteId])

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchQuote(), fetchMessages()])
    setLoading(false)
  }, [fetchQuote, fetchMessages])

  // Initial fetch
  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Polling for near real-time updates
  useEffect(() => {
    intervalRef.current = setInterval(fetchMessages, POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchMessages])

  const sendMessage = useCallback(async (
    body: string,
    channel: 'portal' | 'note',
    attachments?: Attachment[],
    messageType?: string
  ) => {
    const res = await fetch(`/api/quotes/${quoteId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body,
        channel,
        attachments: attachments?.length ? attachments : undefined,
        message_type: messageType || 'text',
      }),
    })

    if (res.ok) {
      const newMsg = await res.json()
      // Optimistic update
      setMessages(prev => [...prev, newMsg])
      // Refetch to get the activity event too
      fetchMessages()
    }

    return res.ok
  }, [quoteId, fetchMessages])

  const markRead = useCallback(async () => {
    await fetch(`/api/quotes/${quoteId}/messages/read`, { method: 'PATCH' })
    // Optimistically update local state
    setMessages(prev =>
      prev.map(m =>
        m.direction === 'inbound' && !m.is_read
          ? { ...m, is_read: true, read_at: new Date().toISOString() }
          : m
      )
    )
  }, [quoteId])

  return { quote, messages, events, loading, sendMessage, markRead, refetch: fetchAll }
}
