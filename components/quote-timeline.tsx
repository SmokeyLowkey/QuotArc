'use client'

import {
  Send,
  Eye,
  RotateCw,
  CheckCircle,
  XCircle,
  MessageSquare,
  MessageSquareText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/format'
import { ChatMessage } from '@/components/chat-message'
import type { QuoteMessage, ActivityEvent, ActivityEventType } from '@/lib/types'

const systemEventConfig: Partial<Record<ActivityEventType, {
  icon: React.ElementType
  color: string
  label: (meta: Record<string, unknown>) => string
}>> = {
  quote_sent: {
    icon: Send,
    color: 'text-sf-accent',
    label: (m) => `Quote sent to ${m.customer_name}`,
  },
  quote_viewed: {
    icon: Eye,
    color: 'text-sf-info',
    label: (m) => `${m.customer_name} viewed the quote`,
  },
  quote_follow_up: {
    icon: RotateCw,
    color: 'text-sf-text-secondary',
    label: (m) => `Follow-up sent to ${m.customer_name}`,
  },
  quote_accepted: {
    icon: CheckCircle,
    color: 'text-sf-success',
    label: (m) => `${m.customer_name} accepted the quote`,
  },
  quote_expired: {
    icon: XCircle,
    color: 'text-sf-danger',
    label: () => 'Quote expired',
  },
  message_sent: {
    icon: MessageSquare,
    color: 'text-sf-accent',
    label: (m) => `Message sent to ${m.customer_name}`,
  },
  customer_replied: {
    icon: MessageSquareText,
    color: 'text-sf-info',
    label: (m) => `${m.customer_name} replied`,
  },
}

// Events that already have a corresponding message — skip them in the timeline
// to avoid duplication (the message bubble shows instead)
const messageEventTypes = new Set<ActivityEventType>(['message_sent', 'customer_replied', 'invoice_sent'])

type TimelineItem =
  | { type: 'event'; data: ActivityEvent; timestamp: string }
  | { type: 'message'; data: QuoteMessage; timestamp: string }

interface QuoteTimelineProps {
  messages: QuoteMessage[]
  events: ActivityEvent[]
  quoteId?: string
}

export function QuoteTimeline({ messages, events, quoteId }: QuoteTimelineProps) {
  // Merge events and messages into a single chronological timeline
  const items: TimelineItem[] = [
    // System events (exclude message_sent/customer_replied since messages render those)
    ...events
      .filter(e => !messageEventTypes.has(e.event_type))
      .map(e => ({ type: 'event' as const, data: e, timestamp: e.created_at })),
    // Messages
    ...messages.map(m => ({ type: 'message' as const, data: m, timestamp: m.created_at })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sf-text-tertiary text-[13px]">
          No activity yet. Send a message to start the conversation.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => {
        if (item.type === 'event') {
          const config = systemEventConfig[item.data.event_type]
          if (!config) return null

          const Icon = config.icon
          const meta = item.data.metadata as Record<string, unknown>

          return (
            <div key={`event-${item.data.id}`} className="flex items-center gap-2 py-2 px-1">
              <div className={cn('shrink-0', config.color)}>
                <Icon size={14} strokeWidth={1.5} />
              </div>
              <span className="text-[12px] text-sf-text-secondary">
                {config.label(meta)}
              </span>
              <span className="text-[11px] text-sf-text-tertiary ml-auto shrink-0">
                {timeAgo(item.data.created_at)}
              </span>
            </div>
          )
        }

        return (
          <ChatMessage
            key={`msg-${item.data.id}`}
            message={item.data}
            isOwnerView={true}
            quoteHref={quoteId ? `/quotes/${quoteId}` : undefined}
          />
        )
      })}
    </div>
  )
}
