'use client'

import { Bell, Eye, CheckCircle, MessageSquareText, DollarSign, Star, Phone, PhoneMissed } from 'lucide-react'
import { useNotifications } from '@/hooks/use-notifications'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/format'
import type { NotificationType } from '@/lib/types'

const notifConfig: Record<NotificationType, { icon: React.ElementType; color: string }> = {
  quote_viewed:    { icon: Eye,              color: 'text-sf-info' },
  quote_accepted:  { icon: CheckCircle,      color: 'text-sf-success' },
  customer_replied: { icon: MessageSquareText, color: 'text-sf-info' },
  invoice_paid:    { icon: DollarSign,       color: 'text-sf-success' },
  review_requested: { icon: Star,            color: 'text-sf-warning' },
  voice_call_lead: { icon: Phone,            color: 'text-sf-info' },
  voice_call_missed: { icon: PhoneMissed,    color: 'text-sf-danger' },
}

export function NotificationBell() {
  const { notifications, unreadCount, loading, markAsRead, markOneAndNavigate } = useNotifications()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center justify-center w-7 h-7 rounded-[4px] text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-surface-2 transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell size={16} strokeWidth={1.5} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-sf-accent text-white text-[10px] font-semibold leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} collisionPadding={12} className="w-80 max-h-[calc(100dvh-80px)] p-0 bg-sf-surface-1 border-sf-border overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-sf-border">
          <span className="text-[12px] font-semibold text-sf-text-primary">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAsRead()}
              className="text-[11px] text-sf-accent hover:text-sf-accent-hover transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="flex-1 overflow-auto">
          {loading ? (
            <div className="py-6 text-center text-sf-text-tertiary text-[13px]">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="py-6 text-center text-sf-text-tertiary text-[13px]">No notifications yet</div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => {
                const config = notifConfig[n.type]
                const Icon = config?.icon || Bell
                const iconColor = config?.color || 'text-sf-text-secondary'

                return (
                  <button
                    key={n.id}
                    onClick={() => markOneAndNavigate(n)}
                    className={cn(
                      'flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-sf-surface-2 transition-colors border-b border-sf-border last:border-0',
                      !n.is_read && 'bg-sf-surface-2/40'
                    )}
                  >
                    <div className={cn('mt-0.5 shrink-0', iconColor)}>
                      <Icon size={15} strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn(
                        'text-[13px] leading-tight',
                        n.is_read ? 'text-sf-text-secondary' : 'text-sf-text-primary font-medium'
                      )}>
                        {n.title}
                      </div>
                      <div className="text-[11px] text-sf-text-tertiary mt-0.5">{n.body}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      <span className="text-[10px] text-sf-text-tertiary">{timeAgo(n.created_at)}</span>
                      {!n.is_read && (
                        <div className="w-1.5 h-1.5 rounded-full bg-sf-accent shrink-0" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
