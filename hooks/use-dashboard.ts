'use client'

import { useState, useEffect, useCallback } from 'react'

export interface DashboardKPIs {
  collectedAllTime: number
  collectedThisMonth: number
  outstanding: number
  overdueAmount: number
  overdueCount: number
  quotesSent: number
  quotesAccepted: number
  revenueWon: number
  acceptanceRate: number
  avgWonValue: number
  jobsScheduled: number
  jobsInProgress: number
  jobsCompletedThisMonth: number
}

export interface MonthlyRevenueDatum {
  month: string
  revenue: number
}

export interface DashboardData {
  kpis: DashboardKPIs
  monthlyRevenue: MonthlyRevenueDatum[]
}

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch {
      // Silently fail
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, refetch: fetchData }
}
