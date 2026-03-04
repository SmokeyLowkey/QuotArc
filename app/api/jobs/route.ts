import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'
import { sendScheduleNotification } from '@/lib/email'

export async function GET(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: Prisma.JobWhereInput = { user_id: user.id }
  if (from || to) {
    where.scheduled_date = {}
    if (from) (where.scheduled_date as Prisma.DateTimeFilter).gte = new Date(from)
    if (to) (where.scheduled_date as Prisma.DateTimeFilter).lte = new Date(to)
  }
  const customerId = searchParams.get('customer_id')
  if (customerId) where.customer_id = customerId
  if (searchParams.get('unlinked') === 'true') where.quote_id = null

  const { page, limit, skip } = (() => {
    const p = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const l = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    return { page: p, limit: l, skip: (p - 1) * l }
  })()

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      include: {
        customer: { select: { name: true, phone: true, address: true } },
        quote: { select: { id: true, public_token: true } },
        voice_call: { select: { id: true, caller_number: true, duration_seconds: true, summary: true, recording_url: true, created_at: true } },
      },
      orderBy: [{ scheduled_date: 'asc' }, { start_time: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.job.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)
  return NextResponse.json({
    jobs,
    pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
  })
}

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const body = await request.json()
  const { quote_id, customer_id, job_type, scheduled_date, start_time, estimated_hours, notes, address } = body

  if (!customer_id || !job_type || !scheduled_date) {
    return NextResponse.json({ error: 'customer_id, job_type, and scheduled_date are required' }, { status: 400 })
  }

  // If linked to a quote, verify ownership
  if (quote_id) {
    const quote = await prisma.quote.findFirst({
      where: { id: quote_id, user_id: user.id },
      select: { id: true },
    })
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }
  }

  // Verify customer ownership
  const customer = await prisma.customer.findFirst({
    where: { id: customer_id, user_id: user.id },
    select: { name: true, email: true, address: true },
  })
  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { company_name: true, phone: true },
  })
  const companyName = profile?.company_name || 'Your electrician'

  // Create job + activity event in transaction
  const job = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const j = await tx.job.create({
      data: {
        user_id: user.id,
        quote_id: quote_id || null,
        customer_id,
        job_type,
        scheduled_date: new Date(scheduled_date),
        start_time: start_time || null,
        estimated_hours: estimated_hours || 2,
        notes: notes || null,
        address: address || customer.address || null,
      },
    })

    await tx.activityEvent.create({
      data: {
        user_id: user.id,
        quote_id: quote_id || null,
        event_type: 'job_scheduled',
        metadata: {
          customer_name: customer.name,
          job_type,
          scheduled_date,
        },
      },
    })

    // If linked to a quote, insert a schedule_card message
    if (quote_id) {
      await tx.quoteMessage.create({
        data: {
          quote_id,
          user_id: user.id,
          direction: 'outbound',
          channel: 'portal',
          message_type: 'schedule_card',
          body: '',
          sender_name: companyName,
          is_read: true,
          metadata: {
            job_id: j.id,
            job_type,
            scheduled_date,
            start_time: start_time || null,
            estimated_hours: estimated_hours || 2,
          } as Prisma.InputJsonValue,
        },
      })
    }

    return j
  })

  // Send schedule notification email to customer (fire-and-forget)
  if (customer.email) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    try {
      await sendScheduleNotification({
        to: customer.email,
        customerName: customer.name,
        companyName,
        companyPhone: profile?.phone,
        jobType: job_type,
        scheduledDate: scheduled_date,
        startTime: start_time || null,
        address: address || customer.address || null,
        quoteUrl: quote_id ? `${baseUrl}/q/${quote_id}` : null,
      })
    } catch (err) {
      console.error('Failed to send schedule notification:', err)
    }
  }

  return NextResponse.json(job, { status: 201 })
}
