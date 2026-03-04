import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendFollowUpEmail } from '@/lib/email'

const MAX_FOLLOW_UPS = 2
const CRON_SECRET = process.env.CRON_SECRET

/**
 * Auto follow-up cron job.
 * Finds quotes where:
 *   - status is 'sent' or 'viewed' (not accepted/expired/draft)
 *   - auto_follow_up is enabled
 *   - next_follow_up <= now
 *   - follow_up_count < MAX_FOLLOW_UPS
 *
 * Sends a follow-up email via Resend, logs activity event, and schedules next follow-up.
 *
 * Trigger: Vercel cron (every hour) or external scheduler hitting GET /api/cron/follow-up
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (skip in dev)
  if (CRON_SECRET) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now = new Date()

  // Find quotes due for follow-up
  const dueQuotes = await prisma.quote.findMany({
    where: {
      auto_follow_up: true,
      status: { in: ['sent', 'viewed'] },
      follow_up_count: { lt: MAX_FOLLOW_UPS },
      next_follow_up: { lte: now },
    },
    include: {
      customer: true,
      user: {
        select: {
          company_name: true,
          phone: true,
          follow_up_template: true,
        },
      },
    },
  })

  if (dueQuotes.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  let sent = 0
  let failed = 0

  for (const quote of dueQuotes) {
    if (!quote.customer?.email) {
      // No customer email — skip and disable follow-up for this quote
      await prisma.quote.update({
        where: { id: quote.id },
        data: { auto_follow_up: false },
      })
      continue
    }

    const newCount = quote.follow_up_count + 1
    const nextFollowUp = newCount < MAX_FOLLOW_UPS
      ? new Date(now.getTime() + quote.follow_up_days * 86400000)
      : null

    try {
      await sendFollowUpEmail({
        to: quote.customer.email,
        customerName: quote.customer.name,
        companyName: quote.user.company_name,
        companyPhone: quote.user.phone,
        quoteNumber: quote.quote_number,
        jobType: quote.job_type,
        total: quote.total.toNumber(),
        quoteUrl: `${baseUrl}/q/${quote.public_token}`,
        chatUrl: `${baseUrl}/q/${quote.public_token}/chat`,
        followUpNumber: newCount,
        customMessage: quote.user.follow_up_template,
      })

      // Update quote and log activity in a transaction
      await prisma.$transaction([
        prisma.quote.update({
          where: { id: quote.id },
          data: {
            follow_up_count: newCount,
            next_follow_up: nextFollowUp,
          },
        }),
        prisma.activityEvent.create({
          data: {
            user_id: quote.user_id,
            quote_id: quote.id,
            event_type: 'quote_follow_up',
            metadata: {
              customer_name: quote.customer.name,
              quote_number: quote.quote_number,
              follow_up_number: newCount,
              job_type: quote.job_type,
            },
          },
        }),
      ])

      sent++
    } catch (err) {
      console.error(`[follow-up] Failed for quote ${quote.quote_number}:`, err)
      failed++
    }
  }

  return NextResponse.json({ processed: dueQuotes.length, sent, failed })
}
