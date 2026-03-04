'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Job, JobStatus } from '@/lib/types'

export function useJobs(dateRange?: { from?: string; to?: string }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (dateRange?.from) params.set('from', dateRange.from)
      if (dateRange?.to) params.set('to', dateRange.to)
      const query = params.toString()
      const res = await fetch(`/api/jobs${query ? `?${query}` : ''}`)
      if (res.ok) {
        const data = await res.json()
        setJobs(data.jobs)
      }
    } catch {
      // Silently fail
    }
    setLoading(false)
  }, [dateRange?.from, dateRange?.to])

  useEffect(() => {
    fetchJobs()

    const channel = supabase
      .channel('jobs-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'jobs',
      }, () => {
        fetchJobs()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, fetchJobs])

  const createJob = useCallback(async (data: {
    quote_id?: string
    customer_id: string
    job_type: string
    scheduled_date: string
    start_time?: string
    estimated_hours?: number
    notes?: string
    address?: string
  }) => {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const job = await res.json()
      setJobs(prev => [...prev, job].sort((a, b) =>
        a.scheduled_date.localeCompare(b.scheduled_date)
      ))
      return job
    }
    return null
  }, [])

  const updateJob = useCallback(async (id: string, data: Partial<Job>) => {
    const res = await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updated } : j))
      return updated
    }
    return null
  }, [])

  const moveJob = useCallback(async (id: string, newStatus: JobStatus) => {
    return updateJob(id, { status: newStatus })
  }, [updateJob])

  const completeJob = useCallback(async (id: string, actualHours: number, notes?: string) => {
    const res = await fetch(`/api/jobs/${id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actual_hours: actualHours, notes }),
    })
    if (res.ok) {
      const result = await res.json()
      // Strip the auto-created invoice summary before merging into jobs state
      const { invoice: _invoice, ...jobData } = result
      setJobs(prev => prev.map(j => j.id === id ? { ...j, ...jobData } : j))
      return result // full response (with invoice) returned to caller
    }
    return null
  }, [])

  const deleteJob = useCallback(async (id: string) => {
    const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setJobs(prev => prev.filter(j => j.id !== id))
    }
  }, [])

  const jobsByStatus = useMemo(() => {
    const grouped: Record<JobStatus, Job[]> = {
      scheduled: [],
      in_progress: [],
      completed: [],
    }
    for (const job of jobs) {
      grouped[job.status]?.push(job)
    }
    return grouped
  }, [jobs])

  const jobsByDate = useMemo(() => {
    const grouped: Record<string, Job[]> = {}
    for (const job of jobs) {
      const date = job.scheduled_date.split('T')[0]
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(job)
    }
    return grouped
  }, [jobs])

  return {
    jobs,
    loading,
    createJob,
    updateJob,
    moveJob,
    completeJob,
    deleteJob,
    jobsByStatus,
    jobsByDate,
    refetch: fetchJobs,
  }
}
