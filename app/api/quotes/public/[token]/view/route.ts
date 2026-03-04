import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Fetch quote by public token
  const quote = await prisma.quote.findUnique({
    where: { public_token: token },
    select: {
      id: true,
      user_id: true,
      viewed_at: true,
      status: true,
      quote_number: true,
      job_type: true,
      total: true,
      customer_id: true,
    },
  })

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  // Only mark as viewed if not already viewed
  if (!quote.viewed_at) {
    const now = new Date()

    // Fetch customer name for the activity event
    const customer = await prisma.customer.findUnique({
      where: { id: quote.customer_id },
      select: { name: true },
    })

    await prisma.$transaction([
      prisma.quote.update({
        where: { id: quote.id },
        data: {
          viewed_at: now,
          status: quote.status === 'sent' ? 'viewed' : quote.status,
        },
      }),
      prisma.activityEvent.create({
        data: {
          user_id: quote.user_id,
          quote_id: quote.id,
          event_type: 'quote_viewed',
          metadata: {
            customer_name: customer?.name,
            quote_number: quote.quote_number,
            job_type: quote.job_type,
            total: quote.total.toNumber(),
          },
        },
      }),
      prisma.notification.create({
        data: {
          user_id: quote.user_id,
          type: 'quote_viewed',
          title: `${customer?.name || 'Customer'} viewed your quote`,
          body: `${quote.quote_number} was just opened`,
          link_url: `/quotes/${quote.id}`,
          metadata: { customer_name: customer?.name, quote_number: quote.quote_number },
        },
      }),
    ])
  }

  return NextResponse.json({ success: true })
}
