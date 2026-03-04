import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'

export async function GET() {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const invoicesP = prisma.invoice.findMany({
    where: { user_id: user.id },
    select: { status: true, total: true, paid_at: true },
  })
  const quotesP = prisma.quote.findMany({
    where: { user_id: user.id },
    select: { status: true, total: true, sent_at: true },
  })
  const jobGroupsP = prisma.job.groupBy({
    by: ['status'],
    where: { user_id: user.id },
    _count: { id: true },
  })
  const jobsCompletedP = prisma.job.count({
    where: { user_id: user.id, status: 'completed', updated_at: { gte: startOfMonth } },
  })
  const paidForChartP = prisma.invoice.findMany({
    where: { user_id: user.id, status: 'paid', paid_at: { gte: sixMonthsAgo } },
    select: { total: true, paid_at: true },
  })

  const [invoices, quotes, jobGroups, jobsCompletedThisMonth, paidForChart] =
    await Promise.all([invoicesP, quotesP, jobGroupsP, jobsCompletedP, paidForChartP]) as [
      Awaited<typeof invoicesP>,
      Awaited<typeof quotesP>,
      Awaited<typeof jobGroupsP>,
      Awaited<typeof jobsCompletedP>,
      Awaited<typeof paidForChartP>,
    ]

  // ── Invoice KPIs ──────────────────────────────────────────
  const paidInvoices = invoices.filter(i => i.status === 'paid')
  const collectedAllTime = paidInvoices.reduce((s, i) => s + i.total.toNumber(), 0)
  const collectedThisMonth = paidInvoices
    .filter(i => i.paid_at && new Date(i.paid_at) >= startOfMonth)
    .reduce((s, i) => s + i.total.toNumber(), 0)
  const outstanding = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((s, i) => s + i.total.toNumber(), 0)
  const overdueAmount = invoices
    .filter(i => i.status === 'overdue')
    .reduce((s, i) => s + i.total.toNumber(), 0)
  const overdueCount = invoices.filter(i => i.status === 'overdue').length

  // ── Quote KPIs ────────────────────────────────────────────
  const sentQuotes = quotes.filter(q => q.sent_at)
  const acceptedQuotes = quotes.filter(q => q.status === 'accepted')
  const revenueWon = acceptedQuotes.reduce((s, q) => s + q.total.toNumber(), 0)
  const acceptanceRate = sentQuotes.length > 0
    ? Math.round((acceptedQuotes.length / sentQuotes.length) * 100)
    : 0
  const avgWonValue = acceptedQuotes.length > 0
    ? revenueWon / acceptedQuotes.length
    : 0

  // ── Job KPIs ──────────────────────────────────────────────
  const jobStatusMap = Object.fromEntries(jobGroups.map(g => [g.status, g._count.id]))
  const jobsScheduled = jobStatusMap.scheduled ?? 0
  const jobsInProgress = jobStatusMap.in_progress ?? 0

  // ── Monthly Revenue Chart (last 6 months) ────────────────
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return {
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      year: d.getFullYear(),
      month: d.getMonth(),
    }
  })

  const monthlyRevenue = months.map(m => {
    const revenue = paidForChart
      .filter(i => {
        const d = new Date(i.paid_at!)
        return d.getFullYear() === m.year && d.getMonth() === m.month
      })
      .reduce((s, i) => s + i.total.toNumber(), 0)
    return { month: m.label, revenue }
  })

  return NextResponse.json({
    kpis: {
      collectedAllTime,
      collectedThisMonth,
      outstanding,
      overdueAmount,
      overdueCount,
      quotesSent: sentQuotes.length,
      quotesAccepted: acceptedQuotes.length,
      revenueWon,
      acceptanceRate,
      avgWonValue,
      jobsScheduled,
      jobsInProgress,
      jobsCompletedThisMonth,
    },
    monthlyRevenue,
  })
}
