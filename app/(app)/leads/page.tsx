'use client'

import { useState } from 'react'
import {
  PhoneIncoming,
  Clock,
  Play,
  Pause,
  User,
  Calendar,
  ChevronDown,
  ChevronRight,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVoiceCalls, type LeadFilter } from '@/hooks/use-voice-calls'
import { PageHeader } from '@/components/page-header'
import { MetricStrip } from '@/components/metric-strip'
import { FilterSidebar } from '@/components/filter-sidebar'
import { PaginationControls } from '@/components/ui/pagination-controls'
import Link from 'next/link'

const FILTER_OPTIONS = [
  { id: 'all', label: 'All Calls' },
  { id: 'appointment_set', label: 'Appointment Set' },
  { id: 'needs_follow_up', label: 'Needs Follow-up' },
  { id: 'no_lead', label: 'No Lead' },
]

function getLeadBadge(call: { appointment_set: boolean; lead_captured: boolean }) {
  if (call.appointment_set) return { label: 'Appointment Set', className: 'bg-sf-success/10 text-sf-success' }
  if (call.lead_captured) return { label: 'Needs Follow-up', className: 'bg-amber-500/10 text-amber-500' }
  return { label: 'No Lead', className: 'bg-sf-surface-2 text-sf-text-tertiary' }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function LeadsPage() {
  const { calls, loading, filter, setFilter, page, setPage, pagination } = useVoiceCalls('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const counts: Record<string, number> = {}
  if (pagination) counts[filter] = pagination.total

  const metricItems = pagination ? [
    { label: 'Total Calls', value: String(pagination.total) },
  ] : []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sf-text-tertiary text-[13px]">Loading calls...</div>
      </div>
    )
  }

  return (
    <div className="px-4 md:px-6 py-4 md:py-6">
      <PageHeader title="Leads" />

      {/* Body: filter sidebar + call list */}
      <div className="flex gap-4">
        {/* Desktop filter sidebar */}
        <FilterSidebar
          filters={FILTER_OPTIONS}
          activeFilter={filter}
          onFilterChange={(id) => setFilter(id as LeadFilter)}
          counts={counts}
        />

        {/* Call list column */}
        <div className="flex-1 min-w-0">
          {/* Mobile filter row */}
          <div className="lg:hidden flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {FILTER_OPTIONS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as LeadFilter)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors whitespace-nowrap shrink-0',
                    filter === f.id
                      ? 'bg-sf-accent text-white'
                      : 'bg-sf-surface-2 text-sf-text-secondary hover:text-sf-text-primary',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {calls.length === 0 && (
            <div className="text-center py-12">
              <PhoneIncoming size={32} strokeWidth={1.5} className="text-sf-text-tertiary mx-auto mb-3" />
              <p className="text-[14px] text-sf-text-tertiary">No calls yet</p>
              <p className="text-[12px] text-sf-text-tertiary mt-1">
                Incoming calls from your AI receptionist will appear here.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            {calls.map(call => {
              const badge = getLeadBadge(call)
              const isExpanded = expandedId === call.id
              const callerName = call.customer?.name ?? null
              const callerDisplay = callerName ?? call.caller_number ?? 'Unknown'
              const metadata = call.metadata as Record<string, unknown>
              const jobType = metadata?.job_type as string | undefined
              const jobId = (call as unknown as Record<string, unknown>).job_id as string | undefined

              return (
                <div key={call.id} className="border border-sf-border rounded-[6px] bg-sf-surface-1 overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : call.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-sf-surface-2/50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-sf-accent/10 flex items-center justify-center shrink-0">
                      <User size={14} className="text-sf-accent" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-sf-text-primary truncate">
                          {callerDisplay}
                        </span>
                        <span className={cn('text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded', badge.className)}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {jobType && (
                          <span className="text-[11px] text-sf-text-secondary">{jobType}</span>
                        )}
                        <span className="text-[11px] text-sf-text-tertiary flex items-center gap-1">
                          <Clock size={10} />
                          {formatDuration(call.duration_seconds)}
                        </span>
                        <span className="text-[11px] text-sf-text-tertiary">
                          {formatDate(call.created_at)}
                        </span>
                      </div>
                    </div>

                    {isExpanded ? (
                      <ChevronDown size={14} className="text-sf-text-tertiary shrink-0" />
                    ) : (
                      <ChevronRight size={14} className="text-sf-text-tertiary shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-sf-border px-3 py-3 space-y-3">
                      {call.summary && (
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-tertiary mb-1">Summary</p>
                          <p className="text-[13px] text-sf-text-secondary leading-relaxed">{call.summary}</p>
                        </div>
                      )}

                      {call.recording_url && (
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-tertiary mb-1">Recording</p>
                          <AudioPlayer src={call.recording_url} />
                        </div>
                      )}

                      {call.transcript && Array.isArray(call.transcript) && call.transcript.length > 0 && (
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-tertiary mb-1">Transcript</p>
                          <div className="max-h-[200px] overflow-y-auto rounded-[4px] bg-sf-surface-0 border border-sf-border p-2 space-y-1.5">
                            {(call.transcript as Array<{ role: string; message: string }>).map((msg, i) => {
                              const isBot = msg.role === 'assistant' || msg.role === 'bot'
                              return (
                                <div key={i} className={cn('text-[12px] leading-relaxed', isBot ? 'text-sf-accent' : 'text-sf-text-primary')}>
                                  <span className="font-semibold">{isBot ? 'AI: ' : 'Caller: '}</span>
                                  {msg.message}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 pt-1 flex-wrap">
                        {call.lead_captured && !call.appointment_set && call.customer && (
                          <Link
                            href={`/quotes/new?customerId=${call.customer.id}`}
                            className="flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] bg-sf-accent text-white text-[12px] font-medium hover:bg-sf-accent-hover transition-colors"
                          >
                            <FileText size={11} />
                            Create Quote
                          </Link>
                        )}
                        {call.customer && (
                          <Link
                            href="/customers"
                            className="flex items-center gap-1 text-[12px] text-sf-accent hover:underline"
                          >
                            <User size={11} />
                            {call.customer.name}
                          </Link>
                        )}
                        {call.appointment_set && (
                          <Link
                            href={jobId ? `/jobs?highlight=${jobId}` : '/jobs'}
                            className="flex items-center gap-1 text-[12px] text-sf-accent hover:underline"
                          >
                            <Calendar size={11} />
                            View Appointment
                          </Link>
                        )}
                        {call.caller_number && callerName && (
                          <span className="text-[11px] text-sf-text-tertiary flex items-center gap-1">
                            <PhoneIncoming size={10} />
                            {call.caller_number}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <PaginationControls page={page} totalPages={pagination.totalPages} onPageChange={setPage} className="mt-4" />
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
      className="flex items-center gap-2 h-8 px-3 rounded-[4px] bg-sf-surface-2 border border-sf-border hover:bg-sf-surface-0 transition-colors"
    >
      {playing ? (
        <Pause size={12} className="text-sf-accent" />
      ) : (
        <Play size={12} className="text-sf-accent" fill="currentColor" />
      )}
      <span className="text-[12px] text-sf-text-secondary">
        {playing ? 'Pause' : 'Play Recording'}
      </span>
    </button>
  )
}
