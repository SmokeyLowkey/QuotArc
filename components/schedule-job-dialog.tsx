'use client'

import { useState } from 'react'
import { CalendarCheck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ScheduleJobDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quoteId: string
  customerId: string
  jobType: string
  customerName: string
  address?: string | null
  onScheduled?: () => void
}

export function ScheduleJobDialog({
  open,
  onOpenChange,
  quoteId,
  customerId,
  jobType,
  customerName,
  address,
  onScheduled,
}: ScheduleJobDialogProps) {
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [startTime, setStartTime] = useState('')
  const [estimatedHours, setEstimatedHours] = useState(2)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const handleSubmit = async () => {
    if (!date) {
      toast.error('Please select a date')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote_id: quoteId,
          customer_id: customerId,
          job_type: jobType,
          scheduled_date: date.toISOString().split('T')[0],
          start_time: startTime || null,
          estimated_hours: estimatedHours,
          notes: notes || null,
          address: address || null,
        }),
      })

      if (res.ok) {
        toast.success('Job scheduled', { description: `${jobType} for ${customerName}` })
        onOpenChange(false)
        onScheduled?.()
        // Reset form
        setDate(undefined)
        setStartTime('')
        setEstimatedHours(2)
        setNotes('')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to schedule job')
      }
    } catch {
      toast.error('Failed to schedule job')
    }
    setSubmitting(false)
  }

  const dateLabel = date
    ? date.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : 'Pick a date'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-sf-surface-0 border-sf-border sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-sf-text-primary flex items-center gap-2">
            <CalendarCheck size={18} strokeWidth={1.5} className="text-sf-accent" />
            Schedule Job
          </DialogTitle>
          <DialogDescription className="text-sf-text-secondary text-[13px]">
            {jobType} for {customerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Date Picker */}
          <div>
            <label className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary block mb-1.5">
              Date *
            </label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    'w-full h-9 px-3 text-left text-[13px] border border-sf-border rounded-[4px] bg-sf-surface-2 transition-colors hover:bg-sf-surface-1',
                    date ? 'text-sf-text-primary' : 'text-sf-text-tertiary'
                  )}
                >
                  {dateLabel}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-sf-surface-0 border-sf-border" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => { setDate(d); setCalendarOpen(false) }}
                  disabled={{ before: new Date() }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Start Time */}
          <div>
            <label className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary block mb-1.5">
              Start Time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="w-full h-9 px-3 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[13px] text-sf-text-primary focus:outline-none focus:ring-1 focus:ring-sf-accent"
            />
          </div>

          {/* Estimated Hours */}
          <div>
            <label className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary block mb-1.5">
              Estimated Hours
            </label>
            <input
              type="number"
              value={estimatedHours}
              onChange={e => setEstimatedHours(parseFloat(e.target.value) || 0)}
              step={0.5}
              min={0.5}
              className="w-24 h-9 px-3 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[13px] font-mono text-sf-text-primary focus:outline-none focus:ring-1 focus:ring-sf-accent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary block mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any scheduling notes..."
              className="w-full px-3 py-2 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[12px] text-sf-text-primary placeholder:text-sf-text-tertiary focus:outline-none focus:ring-1 focus:ring-sf-accent resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleSubmit}
            disabled={!date || submitting}
            className="btn-press h-9 px-4 rounded-[4px] bg-sf-accent hover:bg-sf-accent-hover text-white text-[13px] font-medium transition-colors duration-120 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Scheduling...' : 'Schedule Job'}
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="btn-press h-9 px-3 rounded-[4px] border border-sf-border text-[13px] text-sf-text-secondary hover:bg-sf-surface-2 transition-colors duration-120"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
