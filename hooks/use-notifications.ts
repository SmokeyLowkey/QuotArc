'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import type { Notification } from '@/lib/types'

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=20&page=1')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount)
      }
    } catch {
      // Silently fail
    }
    setLoading(false)
  }, [])

  const markAsRead = useCallback(async (ids?: string[]) => {
    await fetch('/api/notifications/read', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })

    if (ids) {
      setNotifications(prev =>
        prev.map(n => ids.includes(n.id) ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - ids.length))
    } else {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })))
      setUnreadCount(0)
    }
  }, [])

  const markOneAndNavigate = useCallback(async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead([notification.id])
    }
    router.push(notification.link_url)
  }, [markAsRead, router])

  useEffect(() => {
    fetchNotifications()

    // Poll every 10 seconds as a fallback
    const interval = setInterval(fetchNotifications, 10_000)

    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      }, (payload) => {
        const n = payload.new as Notification

        // Check if user is already viewing the relevant page
        const linkPath = n.link_url.split('?')[0]
        const isViewing = pathnameRef.current === linkPath

        if (isViewing) {
          // Auto-mark as read and don't show toast
          fetch('/api/notifications/read', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: [n.id] }),
          })
          setNotifications(prev => [{ ...n, is_read: true, read_at: new Date().toISOString() }, ...prev].slice(0, 20))
        } else {
          setNotifications(prev => [n, ...prev].slice(0, 20))
          setUnreadCount(prev => prev + 1)

          toast(n.title, {
            description: n.body,
            action: {
              label: 'View',
              onClick: () => router.push(n.link_url),
            },
          })
        }
      })
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchNotifications, router])

  return { notifications, unreadCount, loading, markAsRead, markOneAndNavigate, refetch: fetchNotifications }
}
