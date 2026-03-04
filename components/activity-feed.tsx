'use client'

import {
  Send,
  Eye,
  RotateCw,
  CheckCircle,
  XCircle,
  Receipt,
  DollarSign,
  Bell,
  CalendarCheck,
  MessageSquare,
  MessageSquareText,
  Star,
  Phone,
  UserPlus,
  PhoneForwarded,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, timeAgo } from '@/lib/format'
import type { ActivityEvent, ActivityEventType } from '@/lib/types'

const eventConfig: Record<ActivityEventType, {
  icon: React.ElementType
  color: string
  label: (meta: Record<string, unknown>) => string
}> = {
  quote_sent: {
    icon: Send,
    color: 'text-sf-accent',
    label: (m) => `Quote sent to ${m.customer_name}`,
  },
  quote_viewed: {
    icon: Eye,
    color: 'text-sf-info',
    label: (m) => `${m.customer_name} viewed ${m.quote_number}`,
  },
  quote_follow_up: {
    icon: RotateCw,
    color: 'text-sf-text-secondary',
    label: (m) => `Follow-up sent to ${m.customer_name}`,
  },
  quote_accepted: {
    icon: CheckCircle,
    color: 'text-sf-success',
    label: (m) => `${m.customer_name} accepted ${m.quote_number}`,
  },
  quote_expired: {
    icon: XCircle,
    color: 'text-sf-danger',
    label: (m) => `${m.quote_number} expired`,
  },
  message_sent: {
    icon: MessageSquare,
    color: 'text-sf-accent',
    label: (m) => `Message sent to ${m.customer_name}`,
  },
  customer_replied: {
    icon: MessageSquareText,
    color: 'text-sf-info',
    label: (m) => `${m.customer_name} replied to ${m.quote_number}`,
  },
  invoice_sent: {
    icon: Receipt,
    color: 'text-sf-accent',
    label: (m) => `Invoice sent to ${m.customer_name}`,
  },
  invoice_paid: {
    icon: DollarSign,
    color: 'text-sf-success',
    label: (m) => `${m.customer_name} paid ${m.invoice_number}`,
  },
  invoice_reminder: {
    icon: Bell,
    color: 'text-sf-text-secondary',
    label: (m) => `Payment reminder sent to ${m.customer_name}`,
  },
  job_scheduled: {
    icon: CalendarCheck,
    color: 'text-sf-accent',
    label: (m) => `Job scheduled for ${m.customer_name}`,
  },
  review_requested: {
    icon: Star,
    color: 'text-sf-warning',
    label: (m) => `Review request sent to ${m.customer_name}`,
  },
  voice_call_received: {
    icon: Phone,
    color: 'text-sf-info',
    label: (m) => `Call received from ${m.caller_name ?? m.caller_number ?? 'unknown'}`,
  },
  voice_call_lead_captured: {
    icon: UserPlus,
    color: 'text-sf-success',
    label: (m) => `Lead captured: ${m.customer_name ?? 'New lead'}`,
  },
  voice_call_transferred: {
    icon: PhoneForwarded,
    color: 'text-sf-accent',
    label: (m) => `Call transferred to ${m.transfer_number ?? 'your phone'}`,
  },
}

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sf-text-tertiary text-[13px]">
          No activity yet. Send your first quote to get started!
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {events.map((event) => {
        const config = eventConfig[event.event_type]
        if (!config) return null

        const Icon = config.icon
        const meta = event.metadata as Record<string, unknown>
        const label = config.label(meta)
        const total = meta.total ? formatCurrency(Number(meta.total)) : null

        return (
          <div
            key={event.id}
            className="flex items-start gap-3 py-3 border-b border-sf-border last:border-0"
          >
            <div className={cn('mt-0.5 shrink-0', config.color)}>
              <Icon size={16} strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-sf-text-primary">{label}</div>
              <div className="flex items-center gap-2 mt-0.5">
                {typeof meta.job_type === 'string' && (
                  <span className="text-[11px] text-sf-text-secondary">{meta.job_type}</span>
                )}
                {total && (
                  <span className="text-[11px] font-mono text-sf-text-secondary">{total}</span>
                )}
              </div>
            </div>
            <div className="text-[11px] text-sf-text-tertiary shrink-0">
              {timeAgo(event.created_at)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
