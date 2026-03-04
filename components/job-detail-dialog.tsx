'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  Clock,
  MapPin,
  User,
  Phone,
  Play,
  Pause,
  Calendar,
  PhoneIncoming,
  FileText,
  Trash2,
  Receipt,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Job, JobStatus } from '@/lib/types'

interface VoiceCallPartial {
  id: string
  caller_number: string | null
  duration_seconds: number
  summary: string | null
  recording_url: string | null
  created_at: string
}

interface JobDetailDialogProps {
  job: Job & { voice_call?: VoiceCallPartial | null }
  open: boolean
  onClose: () => void
  onStart?: (id: string) => void
  onComplete?: (id: string) => void
  onDelete?: (id: string) => void
}

const STATUS_BADGES: Record<JobStatus, { label: string; className: string }> = {
  scheduled: { label: 'Scheduled', className: 'bg-sf-surface-2 text-sf-text-secondary' },
  in_progress: { label: 'In Progress', className: 'bg-sf-accent/10 text-sf-accent' },
  completed: { label: 'Completed', className: 'bg-sf-success/10 text-sf-success' },
}

export function JobDetailDialog({ job, open, onClose, onStart, onComplete, onDelete }: JobDetailDialogProps) {
  const router = useRouter()
  if (!open) return null

  const dateStr = new Date(job.scheduled_date).toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const statusBadge = STATUS_BADGES[job.status]
  const customer = job.customer as { name?: string; phone?: string; address?: string } | undefined
  const voiceCall = job.voice_call as VoiceCallPartial | null | undefined

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md mx-4 rounded-[6px] border border-sf-border bg-sf-surface-0 shadow-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-sf-border bg-sf-surface-1">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-[15px] font-semibold text-sf-text-primary truncate">{job.job_type}</h2>
            <span className={cn('text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded shrink-0', statusBadge.className)}>
              {statusBadge.label}
            </span>
          </div>
          <button onClick={onClose} className="text-sf-text-tertiary hover:text-sf-text-secondary transition-colors shrink-0 ml-2">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Customer */}
          {customer?.name && (
            <div className="flex items-center gap-2">
              <User size={14} className="text-sf-text-tertiary shrink-0" />
              <span className="text-[13px] text-sf-text-primary">{customer.name}</span>
              {customer.phone && (
                <span className="text-[12px] text-sf-text-tertiary ml-auto">{customer.phone}</span>
              )}
            </div>
          )}

          {/* Date & time */}
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-sf-text-tertiary shrink-0" />
            <span className="text-[13px] text-sf-text-primary">
              {dateStr}{job.start_time ? ` at ${job.start_time}` : ''}
            </span>
          </div>

          {/* Duration */}
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-sf-text-tertiary shrink-0" />
            <span className="text-[13px] text-sf-text-primary">
              Est. {Number(job.estimated_hours)}h
              {job.actual_hours != null && ` · Actual ${Number(job.actual_hours)}h`}
            </span>
          </div>

          {/* Address */}
          {job.address && (
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-sf-text-tertiary shrink-0" />
              <span className="text-[13px] text-sf-text-secondary">{job.address}</span>
            </div>
          )}

          {/* Notes */}
          {job.notes && (
            <div className="flex items-start gap-2">
              <FileText size={14} className="text-sf-text-tertiary shrink-0 mt-0.5" />
              <p className="text-[13px] text-sf-text-secondary leading-relaxed">{job.notes}</p>
            </div>
          )}

          {/* Voice Call card */}
          {voiceCall && (
            <div className="rounded-[4px] border border-sf-accent/20 bg-sf-accent/5 p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <PhoneIncoming size={12} className="text-sf-accent" />
                <span className="text-[11px] font-semibold text-sf-accent uppercase tracking-wider">From Voice Call</span>
              </div>

              <div className="space-y-1 text-[12px]">
                {voiceCall.caller_number && (
                  <div className="flex items-center gap-2">
                    <Phone size={11} className="text-sf-text-tertiary" />
                    <span className="text-sf-text-primary">{voiceCall.caller_number}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock size={11} className="text-sf-text-tertiary" />
                  <span className="text-sf-text-secondary">
                    {Math.floor(voiceCall.duration_seconds / 60)}m {voiceCall.duration_seconds % 60}s
                    {' · '}
                    {new Date(voiceCall.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>

              {voiceCall.summary && (
                <p className="text-[12px] text-sf-text-secondary leading-relaxed">{voiceCall.summary}</p>
              )}

              {voiceCall.recording_url && (
                <AudioPlayer src={voiceCall.recording_url} />
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-sf-border bg-sf-surface-1">
          {job.quote_id && (
            <button
              onClick={() => router.push(`/quotes/${job.quote_id}`)}
              className="btn-press flex items-center gap-1.5 h-8 px-3 rounded-[4px] border border-sf-border text-sf-text-secondary hover:bg-sf-surface-2 hover:text-sf-text-primary text-[13px] font-medium transition-colors"
            >
              <MessageSquare size={14} strokeWidth={1.5} />
              Chat
            </button>
          )}
          {job.status === 'scheduled' && (
            <button
              onClick={() => {
                const params = new URLSearchParams({ jobType: job.job_type })
                if (job.customer_id) params.set('customerId', job.customer_id)
                router.push(`/quotes/new?${params.toString()}`)
              }}
              className="btn-press flex items-center gap-1.5 h-8 px-3 rounded-[4px] border border-sf-accent/30 text-sf-accent hover:bg-sf-accent/10 text-[13px] font-medium transition-colors"
            >
              <Receipt size={14} strokeWidth={1.5} />
              Generate Quote
            </button>
          )}
          {job.status === 'scheduled' && onStart && (
            <button
              onClick={() => onStart(job.id)}
              className="btn-press h-8 px-4 rounded-[4px] bg-sf-accent hover:bg-sf-accent-hover text-white text-[13px] font-medium transition-colors"
            >
              Start Job
            </button>
          )}
          {job.status === 'in_progress' && onComplete && (
            <button
              onClick={() => onComplete(job.id)}
              className="btn-press h-8 px-4 rounded-[4px] bg-sf-success hover:bg-sf-success/80 text-white text-[13px] font-medium transition-colors"
            >
              Complete
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(job.id)}
              className="btn-press h-8 px-3 rounded-[4px] text-sf-text-tertiary hover:text-red-500 hover:bg-red-500/10 text-[12px] transition-colors ml-auto"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Audio Player ──────────────────────────────────────────────

function AudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false)
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)

  const toggle = () => {
    if (!audioEl) {
      const audio = new Audio(src)
      audio.onended = () => setPlaying(false)
      audio.play()
      setAudioEl(audio)
      setPlaying(true)
    } else if (playing) {
      audioEl.pause()
      setPlaying(false)
    } else {
      audioEl.play()
      setPlaying(true)
    }
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 h-7 px-2.5 rounded-[4px] bg-sf-surface-0 border border-sf-border hover:bg-sf-surface-2 transition-colors"
    >
      {playing ? (
        <Pause size={11} className="text-sf-accent" />
      ) : (
        <Play size={11} className="text-sf-accent" fill="currentColor" />
      )}
      <span className="text-[11px] text-sf-text-secondary">
        {playing ? 'Pause' : 'Play Recording'}
      </span>
    </button>
  )
}
