/**
 * Pre-call customer recognition — matches incoming caller phone numbers
 * against existing customers and builds a concise context summary for
 * the voice receptionist's system prompt.
 */

import { prisma } from '@/lib/prisma'
import { phonesMatch } from './phone'

export interface RecognizedCustomer {
  id: string
  name: string
  phone: string | null
  address: string | null
  city: string | null
  contextSummary: string
}

/**
 * Look up a customer by caller phone number for a given electrician.
 * Uses normalized phone matching to handle format differences.
 * Returns null if no match found.
 */
export async function recognizeCallerByPhone(
  userId: string,
  callerNumber: string | undefined,
): Promise<RecognizedCustomer | null> {
  if (!callerNumber) return null

  // Fetch customers with phone for this electrician.
  // Typically <500 per user — fast enough for in-memory filtering.
  const customers = await prisma.customer.findMany({
    where: {
      user_id: userId,
      phone: { not: null },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      city: true,
      property_notes: true,
      panel_size: true,
      service_amps: true,
    },
  })

  const match = customers.find(c => phonesMatch(c.phone, callerNumber))
  if (!match) return null

  // Fetch recent history in parallel
  const [quotes, jobs, invoices, callCount] = await Promise.all([
    prisma.quote.findMany({
      where: { customer_id: match.id, user_id: userId },
      select: { job_type: true, status: true, total: true, created_at: true },
      orderBy: { created_at: 'desc' },
      take: 5,
    }),
    prisma.job.findMany({
      where: { customer_id: match.id, user_id: userId },
      select: { job_type: true, status: true, scheduled_date: true },
      orderBy: { scheduled_date: 'desc' },
      take: 3,
    }),
    prisma.invoice.findMany({
      where: { customer_id: match.id, user_id: userId },
      select: { status: true, total: true },
      orderBy: { created_at: 'desc' },
      take: 3,
    }),
    prisma.voiceCall.count({
      where: { customer_id: match.id, user_id: userId },
    }),
  ])

  const contextSummary = buildContextSummary(match, quotes, jobs, invoices, callCount)

  return {
    id: match.id,
    name: match.name,
    phone: match.phone,
    address: match.address,
    city: match.city,
    contextSummary,
  }
}

function buildContextSummary(
  customer: {
    name: string
    address: string | null
    city: string | null
    property_notes: string | null
    panel_size: string | null
    service_amps: string | null
  },
  quotes: { job_type: string; status: string; total: unknown; created_at: Date }[],
  jobs: { job_type: string; status: string; scheduled_date: Date }[],
  invoices: { status: string; total: unknown }[],
  callCount: number,
): string {
  const lines: string[] = []

  lines.push(`RETURNING CUSTOMER: ${customer.name}`)

  if (customer.address) {
    lines.push(`Address: ${customer.address}${customer.city ? `, ${customer.city}` : ''}`)
  }

  const propertyParts: string[] = []
  if (customer.panel_size) propertyParts.push(`panel: ${customer.panel_size}`)
  if (customer.service_amps) propertyParts.push(`service: ${customer.service_amps}`)
  if (propertyParts.length) lines.push(`Property: ${propertyParts.join(', ')}`)
  if (customer.property_notes) lines.push(`Notes: ${customer.property_notes}`)

  if (quotes.length > 0) {
    const qSummaries = quotes.slice(0, 3).map(q => {
      const total = Number(q.total)
      return `${q.job_type} (${q.status}${total > 0 ? `, $${total.toFixed(0)}` : ''})`
    })
    lines.push(`Recent quotes: ${qSummaries.join('; ')}`)
  }

  const activeJobs = jobs.filter(j => j.status === 'scheduled')
  if (activeJobs.length > 0) {
    const j = activeJobs[0]
    const dateStr = new Date(j.scheduled_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    lines.push(`Upcoming job: ${j.job_type} on ${dateStr}`)
  }

  const unpaid = invoices.filter(i => i.status === 'sent' || i.status === 'overdue')
  if (unpaid.length > 0) {
    const total = unpaid.reduce((sum, i) => sum + Number(i.total), 0)
    lines.push(`Outstanding balance: $${total.toFixed(0)} (${unpaid.length} invoice${unpaid.length > 1 ? 's' : ''})`)
  }

  if (callCount > 0) {
    lines.push(`Previous calls: ${callCount}`)
  }

  return lines.join('\n')
}
