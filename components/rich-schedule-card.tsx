'use client'

import { CalendarCheck, Clock, MapPin } from 'lucide-react'

interface RichScheduleCardProps {
  jobType: string
  scheduledDate: string
  startTime?: string | null
  estimatedHours?: number
  address?: string | null
}

export function RichScheduleCard({ jobType, scheduledDate, startTime, estimatedHours, address }: RichScheduleCardProps) {
  const dateStr = new Date(scheduledDate).toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-[8px] border border-sf-border bg-sf-surface-1">
      <div className="w-9 h-9 rounded-[6px] bg-sf-success/10 flex items-center justify-center shrink-0">
        <CalendarCheck size={18} className="text-sf-success" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-sf-text-primary">{jobType}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Clock size={11} strokeWidth={1.5} className="text-sf-text-tertiary" />
          <span className="text-[12px] text-sf-text-secondary">
            {dateStr}{startTime ? ` at ${startTime}` : ''}
          </span>
          {estimatedHours && (
            <span className="text-[11px] text-sf-text-tertiary">· {estimatedHours}h</span>
          )}
        </div>
        {address && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <MapPin size={11} strokeWidth={1.5} className="text-sf-text-tertiary" />
            <span className="text-[12px] text-sf-text-secondary truncate">{address}</span>
          </div>
        )}
      </div>
    </div>
  )
}
