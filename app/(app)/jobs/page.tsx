'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutGrid, List, Clock, Play, CheckCircle2, ChevronDown, ChevronRight, PhoneIncoming, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useJobs } from '@/hooks/use-jobs'
import { JobKanban } from '@/components/job-kanban'
import { JobDetailDialog } from '@/components/job-detail-dialog'
import { PageHeader } from '@/components/page-header'
import { toast } from 'sonner'
import type { Job, JobStatus } from '@/lib/types'

type ViewMode = 'kanban' | 'list'

function getWeekRange(offsetWeeks: number): { from: string; to: string; label: string } {
  const now = new Date()
  // Find Monday of current week
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1 // 0=Mon…6=Sun
  const monday = new Date(now)
  monday.setDate(now.getDate() - dayOfWeek + offsetWeeks * 7)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const fmt = (d: Date) => d.toISOString().split('T')[0]

  const isCurrentWeek = offsetWeeks === 0
  const label = isCurrentWeek
    ? 'This Week'
    : monday.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) +
      ' – ' +
      sunday.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })

  return { from: fmt(monday), to: fmt(sunday), label }
}

export default function JobsPage() {
  const router = useRouter()
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('sf-jobs-view') as ViewMode) || 'kanban'
    }
    return 'kanban'
  })
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [completingJob, setCompletingJob] = useState<string | null>(null)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)

  const weekRange = getWeekRange(weekOffset)
  // Kanban shows ALL active jobs (no date filter); list view filters by week
  const { jobs, loading, jobsByStatus, jobsByDate, moveJob, completeJob, deleteJob, updateJob } = useJobs(
    view === 'list' ? weekRange : undefined
  )

  const toggleView = (v: ViewMode) => {
    setView(v)
    localStorage.setItem('sf-jobs-view', v)
  }

  const handleMoveJob = useCallback(async (id: string, newStatus: JobStatus) => {
    await moveJob(id, newStatus)
    toast('Job status updated', { duration: 2000 })
  }, [moveJob])

  const handleStartJob = useCallback(async (id: string) => {
    await updateJob(id, { status: 'in_progress' })
    toast('Job started', { duration: 2000 })
    setSelectedJobId(null)
  }, [updateJob])

  const handleCompleteJob = useCallback(async (id: string, hours: number, notes: string) => {
    const result = await completeJob(id, hours, notes || undefined)
    setCompletingJob(null)
    setSelectedJobId(null)
    if (result?.invoice) {
      toast('Job completed', {
        description: `Draft invoice ${result.invoice.invoice_number} created`,
        duration: 5000,
        action: {
          label: 'View Invoice',
          onClick: () => router.push(`/invoices/${result.invoice.id}`),
        },
      })
    } else {
      toast('Job completed', { duration: 2000 })
    }
  }, [completeJob, router])

  const handleDeleteJob = useCallback(async (id: string) => {
    await deleteJob(id)
    toast('Job deleted', { duration: 2000 })
    setSelectedJobId(null)
  }, [deleteJob])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sf-text-tertiary text-[13px]">Loading jobs...</div>
      </div>
    )
  }

  const sortedDates = Object.keys(jobsByDate).sort()
  const selectedJob = selectedJobId ? jobs.find(j => j.id === selectedJobId) : null

  const listViewContent = (
    <div className="flex flex-col gap-1">
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="btn-press flex items-center gap-1 h-7 px-2 rounded-[4px] text-[12px] text-sf-text-secondary border border-sf-border hover:bg-sf-surface-2 transition-colors"
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Prev
        </button>
        <button
          onClick={() => setWeekOffset(0)}
          className={cn(
            'text-[12px] font-medium px-2.5 py-1 rounded-[4px] transition-colors',
            weekOffset === 0
              ? 'text-sf-accent bg-sf-accent/10'
              : 'text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-surface-2',
          )}
        >
          {weekRange.label}
        </button>
        <button
          onClick={() => setWeekOffset(w => w + 1)}
          className="btn-press flex items-center gap-1 h-7 px-2 rounded-[4px] text-[12px] text-sf-text-secondary border border-sf-border hover:bg-sf-surface-2 transition-colors"
        >
          Next
          <ChevronRight size={13} strokeWidth={1.5} />
        </button>
      </div>

      {sortedDates.length === 0 && (
        <p className="text-sf-text-tertiary text-[13px] py-8 text-center">No jobs this week</p>
      )}
      {sortedDates.map(date => {
        const dayJobs = jobsByDate[date]
        const d = new Date(date + 'T00:00:00')
        const dayLabel = d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })
        const isToday = date === new Date().toISOString().split('T')[0]

        return (
          <div key={date}>
            <button
              onClick={() => setExpandedDay(expandedDay === date ? null : date)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-[4px] hover:bg-sf-surface-2 transition-colors duration-120"
            >
              <div className="flex items-center gap-3">
                <span className={cn('text-[13px] font-medium w-28', isToday ? 'text-sf-accent' : 'text-sf-text-primary')}>
                  {isToday ? 'Today' : dayLabel}
                </span>
                <span className="text-[12px] text-sf-text-tertiary">
                  {dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}
                </span>
              </div>
              {expandedDay === date ? (
                <ChevronDown size={14} strokeWidth={1.5} className="text-sf-text-tertiary" />
              ) : (
                <ChevronRight size={14} strokeWidth={1.5} className="text-sf-text-tertiary" />
              )}
            </button>

            {expandedDay === date && (
              <div className="ml-3 pl-3 border-l border-sf-border mt-1 mb-2 flex flex-col gap-1.5">
                {dayJobs.map(job => (
                  <div key={job.id}>
                    <div
                      onClick={() => setSelectedJobId(job.id)}
                      className={cn(
                        'flex items-center justify-between px-3 py-2.5 bg-sf-surface-1 border border-sf-border rounded-[4px] cursor-pointer hover:bg-sf-surface-2 transition-colors',
                        job.status === 'in_progress' && 'border-l-[3px] border-l-sf-accent',
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {job.start_time && (
                          <span className="text-[12px] font-mono text-sf-text-tertiary w-14 shrink-0">{job.start_time}</span>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-medium text-sf-text-primary">{job.job_type}</span>
                            {job.voice_call_id && (
                              <PhoneIncoming size={11} className="text-sf-accent shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-sf-text-secondary">
                            {(job.customer as { name?: string })?.name || 'Customer'}
                            {job.address && ` · ${job.address}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-sf-text-tertiary">{Number(job.estimated_hours)}h</span>
                        {job.status === 'scheduled' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStartJob(job.id) }}
                            className="btn-press flex items-center gap-1 h-6 px-2 rounded-[4px] text-[11px] font-medium text-sf-text-secondary border border-sf-border hover:bg-sf-surface-2 transition-colors"
                          >
                            <Play size={10} strokeWidth={2} fill="currentColor" />
                            Start
                          </button>
                        )}
                        {job.status === 'in_progress' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setCompletingJob(job.id) }}
                            className="btn-press flex items-center gap-1 h-6 px-2 rounded-[4px] text-[11px] font-medium text-sf-accent border border-sf-accent/30 hover:bg-sf-accent/10 transition-colors"
                          >
                            <CheckCircle2 size={10} strokeWidth={2} />
                            Complete
                          </button>
                        )}
                      </div>
                    </div>

                    {completingJob === job.id && (
                      <CompleteJobPanel
                        job={job}
                        onComplete={handleCompleteJob}
                        onCancel={() => setCompletingJob(null)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="px-4 md:px-6 py-4 md:py-6">
      <PageHeader
        title="Jobs"
        actions={
          /* View toggle — desktop only */
          <div className="hidden lg:flex items-center h-8 border border-sf-border rounded-[4px] overflow-hidden">
            <button
              onClick={() => toggleView('kanban')}
              className={cn(
                'flex items-center justify-center w-8 h-full transition-colors',
                view === 'kanban' ? 'bg-sf-accent text-white' : 'text-sf-text-tertiary hover:text-sf-text-secondary hover:bg-sf-surface-2',
              )}
              title="Kanban view"
            >
              <LayoutGrid size={14} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => toggleView('list')}
              className={cn(
                'flex items-center justify-center w-8 h-full transition-colors',
                view === 'list' ? 'bg-sf-accent text-white' : 'text-sf-text-tertiary hover:text-sf-text-secondary hover:bg-sf-surface-2',
              )}
              title="List view"
            >
              <List size={14} strokeWidth={1.5} />
            </button>
          </div>
        }
      />

      {/* Mobile: always list view */}
      <div className="lg:hidden">
        {listViewContent}
      </div>

      {/* Desktop: kanban or list based on view state */}
      <div className="hidden lg:block">
        {view === 'kanban' && (
          <JobKanban
            jobsByStatus={jobsByStatus}
            onMoveJob={handleMoveJob}
            onClickJob={(job) => setSelectedJobId(job.id)}
          />
        )}
        {view === 'list' && listViewContent}
      </div>

      {/* Job Detail Dialog */}
      {selectedJob && (
        <JobDetailDialog
          job={selectedJob}
          open={!!selectedJob}
          onClose={() => setSelectedJobId(null)}
          onStart={handleStartJob}
          onComplete={(id) => {
            setSelectedJobId(null)
            setCompletingJob(id)
          }}
          onDelete={handleDeleteJob}
        />
      )}

      {/* Complete Job Panel (for kanban view) */}
      {completingJob && (() => {
        const job = jobs.find(j => j.id === completingJob)
        if (!job) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md mx-4">
              <CompleteJobPanel
                job={job}
                onComplete={handleCompleteJob}
                onCancel={() => setCompletingJob(null)}
              />
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function CompleteJobPanel({
  job,
  onComplete,
  onCancel,
}: {
  job: Job
  onComplete: (id: string, hours: number, notes: string) => void
  onCancel: () => void
}) {
  const [hours, setHours] = useState(Number(job.estimated_hours))
  const [notes, setNotes] = useState('')

  return (
    <div className="mt-1 border border-sf-border rounded-[6px] bg-sf-surface-1 p-3 space-y-3">
      <div className="text-[13px] font-semibold text-sf-text-primary flex items-center gap-2">
        <CheckCircle2 size={14} strokeWidth={1.5} className="text-sf-success" />
        Complete: {job.job_type}
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary block mb-1">
          How long did this take?
        </label>
        <div className="flex items-center gap-2">
          <Clock size={14} strokeWidth={1.5} className="text-sf-text-tertiary" />
          <input
            type="number"
            value={hours}
            onChange={e => setHours(parseFloat(e.target.value) || 0)}
            step={0.5}
            min={0}
            className="w-20 h-7 px-2 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[13px] font-mono text-sf-text-primary focus:outline-none focus:ring-1 focus:ring-sf-accent"
          />
          <span className="text-[12px] text-sf-text-tertiary">hours (est. {Number(job.estimated_hours)}h)</span>
        </div>
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary block mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Completion notes..."
          className="w-full px-3 py-2 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[12px] text-sf-text-primary placeholder:text-sf-text-tertiary focus:outline-none focus:ring-1 focus:ring-sf-accent resize-none"
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onComplete(job.id, hours, notes)}
          className="btn-press h-8 px-4 rounded-[4px] bg-sf-accent hover:bg-sf-accent-hover text-white text-[13px] font-medium transition-colors duration-120"
        >
          Complete Job
        </button>
        <button
          onClick={onCancel}
          className="btn-press h-8 px-3 text-[12px] text-sf-text-tertiary hover:text-sf-text-secondary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
