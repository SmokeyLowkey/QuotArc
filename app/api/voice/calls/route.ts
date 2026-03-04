/**
 * Voice Calls API — Lists voice call records for the authenticated user.
 * Used by the Leads page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') // appointment_set | needs_follow_up | no_lead
  const days = parseInt(searchParams.get('days') || '30', 10) // default 30 days
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const skip = (page - 1) * limit

  // Build where clause
  const where: Record<string, unknown> = { user_id: user.id }

  // Date filter (0 = all time)
  if (days > 0) {
    const since = new Date()
    since.setDate(since.getDate() - days)
    where.created_at = { gte: since }
  }

  if (filter === 'appointment_set') {
    where.appointment_set = true
  } else if (filter === 'needs_follow_up') {
    where.lead_captured = true
    where.appointment_set = false
  } else if (filter === 'no_lead') {
    where.lead_captured = false
  }

  const [calls, total] = await Promise.all([
    prisma.voiceCall.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
      include: { job: { select: { id: true } } },
    }),
    prisma.voiceCall.count({ where }),
  ])

  // Fetch customer names for calls with customer_id
  const customerIds = [...new Set(calls.filter((c: (typeof calls)[number]) => c.customer_id).map((c: (typeof calls)[number]) => c.customer_id!))]
  const customers = customerIds.length > 0
    ? await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true, phone: true },
      })
    : []

  const customerMap = new Map(customers.map((c: (typeof customers)[number]) => [c.id, c]))

  const enriched = calls.map((call: (typeof calls)[number]) => ({
    ...call,
    duration_minutes: Number(call.duration_minutes),
    customer: call.customer_id ? customerMap.get(call.customer_id) ?? null : null,
    job_id: call.job?.id ?? null,
  }))

  const totalPages = Math.ceil(total / limit)
  return NextResponse.json({
    calls: enriched,
    pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
  })
}
