'use client'

import { useState, useCallback } from 'react'
import {
  quotes as initialQuotes,
  jobs as initialJobs,
  invoices as initialInvoices,
  customers as initialCustomers,
  type Quote,
  type Job,
  type Invoice,
  type Customer,
  type QuoteStatus,
  type InvoiceStatus,
} from '@/lib/mock-data'

// Legacy mock hooks — kept for pages not yet migrated to real API hooks.
// Real hooks: use-invoices.ts, use-jobs.ts, use-quote-detail.ts, etc.

export function useQuotes() {
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes)

  const addQuote = useCallback((quote: Quote) => {
    setQuotes(prev => [quote, ...prev])
  }, [])

  const updateQuote = useCallback((id: string, updates: Partial<Quote>) => {
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q))
  }, [])

  const sendQuote = useCallback((id: string) => {
    setQuotes(prev => prev.map(q => q.id === id ? {
      ...q,
      status: 'sent' as QuoteStatus,
      sentAt: new Date().toISOString(),
    } : q))
  }, [])

  const getQuotesByStatus = useCallback((status: QuoteStatus | 'all') => {
    if (status === 'all') return quotes
    return quotes.filter(q => q.status === status)
  }, [quotes])

  const stats = {
    sentThisMonth: quotes.filter(q => q.sentAt).length,
    viewed: quotes.filter(q => q.viewedAt).length,
    viewedRate: Math.round((quotes.filter(q => q.viewedAt).length / Math.max(quotes.filter(q => q.sentAt).length, 1)) * 100),
    accepted: quotes.filter(q => q.status === 'accepted').length,
    acceptedRate: Math.round((quotes.filter(q => q.status === 'accepted').length / Math.max(quotes.filter(q => q.sentAt).length, 1)) * 100),
    revenueWon: quotes.filter(q => q.status === 'accepted').reduce((sum, q) => sum + q.total, 0),
  }

  return { quotes, addQuote, updateQuote, sendQuote, getQuotesByStatus, stats }
}

export function useJobs() {
  const [allJobs, setJobs] = useState<Job[]>(initialJobs)

  const updateJob = useCallback((id: string, updates: Partial<Job>) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j))
  }, [])

  const completeJob = useCallback((id: string, data: { actualHours: number; notes: string }) => {
    setJobs(prev => prev.map(j => j.id === id ? {
      ...j,
      status: 'completed' as const,
      elapsedHours: data.actualHours,
      notes: data.notes,
    } : j))
  }, [])

  const todayJobs = allJobs.filter(j => j.date === '2026-02-23')
  const weekJobs = allJobs.filter(j => j.date > '2026-02-23' && j.date <= '2026-03-01')

  const weekByDay = weekJobs.reduce<Record<string, Job[]>>((acc, job) => {
    if (!acc[job.date]) acc[job.date] = []
    acc[job.date].push(job)
    return acc
  }, {})

  return { jobs: allJobs, todayJobs, weekJobs, weekByDay, updateJob, completeJob }
}

export function useInvoices() {
  const [allInvoices, setInvoices] = useState<Invoice[]>(initialInvoices)

  const addInvoice = useCallback((invoice: Invoice) => {
    setInvoices(prev => [invoice, ...prev])
  }, [])

  const sendInvoice = useCallback((id: string) => {
    setInvoices(prev => prev.map(inv => inv.id === id ? {
      ...inv,
      status: 'sent' as InvoiceStatus,
      sentAt: new Date().toISOString(),
    } : inv))
  }, [])

  const sendReminder = useCallback((id: string) => {
    console.log('Reminder sent for invoice', id)
  }, [])

  const stats = {
    outstanding: allInvoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.total, 0),
    overdue: allInvoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.total, 0),
    overdueCount: allInvoices.filter(i => i.status === 'overdue').length,
    collectedThisMonth: allInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0),
  }

  return { invoices: allInvoices, addInvoice, sendInvoice, sendReminder, stats }
}

export function useCustomers() {
  const [allCustomers, setCustomers] = useState<Customer[]>(initialCustomers)

  const addCustomer = useCallback((customer: Customer) => {
    setCustomers(prev => [customer, ...prev])
  }, [])

  const updateCustomer = useCallback((id: string, updates: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
  }, [])

  const searchCustomers = useCallback((query: string) => {
    if (!query) return allCustomers
    const q = query.toLowerCase()
    return allCustomers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q) ||
      c.area.toLowerCase().includes(q)
    )
  }, [allCustomers])

  return { customers: allCustomers, addCustomer, updateCustomer, searchCustomers }
}
