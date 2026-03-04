import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CRON_SECRET = process.env.CRON_SECRET
// Fallback: quotes sent more than this many days ago with no explicit expired_at are expired
const DEFAULT_EXPIRY_DAYS = 30

/**
 * Quote expiry cron job.
 * Finds quotes where:
 *   - status is 'sent' or 'viewed'
 *   - expired_at is set and is in the past, OR sent_at > DEFAULT_EXPIRY_DAYS ago
 *
 * Marks them as 'expired' and logs a quote_expired activity event.
 *
 * Trigger: Vercel cron (daily at 5 AM) or external scheduler hitting GET /api/cron/quote-expiry
 */
export async function GET(request: NextRequest) {
  if (CRON_SECRET) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now = new Date()
  const fallbackCutoff = new Date(now.getTime() - DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

  const expiredQuotes = await prisma.quote.findMany({
    where: {
      status: { in: ['sent', 'viewed'] },
      OR: [
        { expired_at: { lte: now } },
        { expired_at: null, sent_at: { lte: fallbackCutoff } },
      ],
    },
    select: {
      id: true,
      user_id: true,
      quote_number: true,
      total: true,
      customer: { select: { name: true } },
    },
  })

  if (expiredQuotes.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let marked = 0
  let failed = 0

  for (const quote of expiredQuotes) {
    try {
      await prisma.$transaction([
        prisma.quote.update({
          where: { id: quote.id },
          data: { status: 'expired' },
        }),
        prisma.activityEvent.create({
          data: {
            user_id: quote.user_id,
            quote_id: quote.id,
            event_type: 'quote_expired',
            metadata: {
              quote_number: quote.quote_number,
              customer_name: quote.customer.name,
              total: (quote.total as unknown as { toNumber: () => number }).toNumber(),
            },
          },
        }),
      ])
      marked++
    } catch (err) {
      console.error(`[quote-expiry] Failed for quote ${quote.quote_number}:`, err)
      failed++
    }
  }

  return NextResponse.json({ processed: expiredQuotes.length, marked, failed })
}
