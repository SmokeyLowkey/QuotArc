import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * Overdue invoice cron job.
 * Finds invoices where:
 *   - status is 'sent' (not draft/paid/overdue)
 *   - due_date < today
 *
 * Marks them as 'overdue' and logs an activity event.
 *
 * Trigger: Vercel cron (daily at 6 AM) or external scheduler hitting GET /api/cron/overdue-invoices
 */
export async function GET(request: NextRequest) {
  if (CRON_SECRET) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now = new Date()
  // Normalize to start of today so invoices due today are not marked overdue yet
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      status: 'sent',
      due_date: { lt: today },
    },
    select: { id: true, user_id: true, invoice_number: true, total: true, customer_id: true },
  })

  if (overdueInvoices.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let marked = 0
  let failed = 0

  for (const invoice of overdueInvoices) {
    try {
      await prisma.$transaction([
        prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: 'overdue' },
        }),
        prisma.activityEvent.create({
          data: {
            user_id: invoice.user_id,
            invoice_id: invoice.id,
            event_type: 'invoice_overdue',
            metadata: {
              invoice_number: invoice.invoice_number,
              total: invoice.total.toNumber(),
            },
          },
        }),
      ])
      marked++
    } catch (err) {
      console.error(`[overdue-invoices] Failed for invoice ${invoice.invoice_number}:`, err)
      failed++
    }
  }

  return NextResponse.json({ processed: overdueInvoices.length, marked, failed })
}
