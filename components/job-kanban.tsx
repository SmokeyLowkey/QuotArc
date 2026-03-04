'use client'

import { useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, MapPin, PhoneIncoming, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Job, JobStatus } from '@/lib/types'

const columns: { id: JobStatus; label: string; color: string }[] = [
  { id: 'scheduled', label: 'Scheduled', color: 'bg-sf-text-tertiary' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-sf-accent' },
  { id: 'completed', label: 'Completed', color: 'bg-sf-success' },
]

const STATUS_LEFT_BORDER: Record<JobStatus, string> = {
  scheduled: 'border-l-sf-border',
  in_progress: 'border-l-sf-accent',
  completed: 'border-l-sf-success',
}

interface JobKanbanProps {
  jobsByStatus: Record<JobStatus, Job[]>
  onMoveJob: (id: string, newStatus: JobStatus) => Promise<unknown>
  onClickJob?: (job: Job) => void
}

export function JobKanban({ jobsByStatus, onMoveJob, onClickJob }: JobKanbanProps) {
  const [activeJob, setActiveJob] = useState<Job | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const job = Object.values(jobsByStatus).flat().find(j => j.id === event.active.id)
    setActiveJob(job || null)
  }, [jobsByStatus])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveJob(null)
    const { active, over } = event
    if (!over) return

    const jobId = active.id as string
    const targetColumn = over.id as JobStatus

    if (columns.some(c => c.id === targetColumn)) {
      const job = Object.values(jobsByStatus).flat().find(j => j.id === jobId)
      if (job && job.status !== targetColumn) {
        onMoveJob(jobId, targetColumn)
      }
    }
  }, [jobsByStatus, onMoveJob])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {columns.map(col => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            label={col.label}
            color={col.color}
            jobs={jobsByStatus[col.id] || []}
            onClickJob={onClickJob}
          />
        ))}
      </div>

      <DragOverlay>
        {activeJob ? <JobCard job={activeJob} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function KanbanColumn({
  id,
  label,
  color,
  jobs,
  onClickJob,
}: {
  id: JobStatus
  label: string
  color: string
  jobs: Job[]
  onClickJob?: (job: Job) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-[6px] border border-sf-border bg-sf-surface-0 p-2 min-h-[200px] transition-colors',
        isOver && 'bg-sf-surface-2/50 border-sf-accent/30'
      )}
    >
      <div className="flex items-center gap-2 px-1 mb-2">
        <span className={cn('w-2 h-2 rounded-full', color)} />
        <span className="text-[12px] font-semibold text-sf-text-secondary">{label}</span>
        <span className="text-[11px] text-sf-text-tertiary ml-auto">{jobs.length}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {jobs.map(job => (
          <SortableJobCard key={job.id} job={job} onClick={() => onClickJob?.(job)} />
        ))}
        {jobs.length === 0 && (
          <div className="text-[12px] text-sf-text-tertiary text-center py-6">
            No jobs
          </div>
        )}
      </div>
    </div>
  )
}

function SortableJobCard({ job, onClick }: { job: Job; onClick?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: job.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <JobCard job={job} isDragging={isDragging} onClick={onClick} />
    </div>
  )
}

function JobCard({ job, isDragging, onClick }: { job: Job; isDragging?: boolean; onClick?: () => void }) {
  const router = useRouter()

  const dateStr = new Date(job.scheduled_date).toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const customer = job.customer as { name?: string } | undefined

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-[4px] border border-sf-border border-l-[3px] bg-sf-surface-1 px-2.5 py-2.5 cursor-grab active:cursor-grabbing select-none',
        STATUS_LEFT_BORDER[job.status],
        isDragging && 'opacity-50 shadow-lg',
        onClick && 'hover:bg-sf-surface-2 transition-colors duration-120',
      )}
    >
      {/* Top row: job type + action icons */}
      <div className="flex items-start justify-between gap-1.5">
        <span className="text-[13px] font-semibold text-sf-text-primary leading-snug">{job.job_type}</span>
        <div className="flex items-center gap-0.5 shrink-0 mt-[1px]">
          {job.voice_call_id && (
            <PhoneIncoming size={11} className="text-sf-accent" aria-label="From voice call" />
          )}
          {job.quote_id && (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); router.push(`/quotes/${job.quote_id}`) }}
              className="flex items-center justify-center w-5 h-5 rounded-[3px] text-sf-text-tertiary hover:text-sf-accent hover:bg-sf-accent/10 transition-colors"
              aria-label="View quote chat"
              title="View quote & chat"
            >
              <MessageSquare size={11} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* Customer name */}
      <div className="text-[12px] font-medium text-sf-text-secondary mt-0.5">
        {customer?.name || 'Customer'}
      </div>

      {/* Date + time */}
      <div className="flex items-center gap-1 mt-1.5 text-[11px] text-sf-text-tertiary">
        <Clock size={10} strokeWidth={1.5} />
        <span>{dateStr}{job.start_time ? ` · ${job.start_time}` : ''}</span>
      </div>

      {/* Address */}
      {job.address && (
        <div className="flex items-center gap-1 mt-0.5 text-[11px] text-sf-text-tertiary">
          <MapPin size={10} strokeWidth={1.5} />
          <span className="truncate">{job.address}</span>
        </div>
      )}

      {/* Footer: hours */}
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] text-sf-text-tertiary">
          Est. {Number(job.estimated_hours)}h
          {job.actual_hours != null && ` · Actual ${Number(job.actual_hours)}h`}
        </span>
        {job.quote_id && (
          <span className="text-[10px] font-medium text-sf-accent/70 bg-sf-accent/8 px-1.5 py-0.5 rounded-[3px]">
            Quote
          </span>
        )}
      </div>
    </div>
  )
}
