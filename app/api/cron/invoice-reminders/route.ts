import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendInvoiceReminderEmail } from '@/lib/email'

const MAX_REMINDERS = 3
const REMINDER_INTERVAL_DAYS = 3
const CRON_SECRET = process.env.CRON_SECRET
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * Invoice reminder cron job.
 * Finds unpaid invoices where next_reminder <= now and sends a payment reminder.
 * Works for both "sent" (pre-due) and "overdue" invoices.
 *
 * Payment links use /pay/[token] — a permanent URL that generates a fresh
 * Stripe Checkout Session on demand, so they never expire.
 *
 * Trigger: Vercel cron (daily at 7 AM) or external scheduler
 */
export async function GET(request: NextRequest) {
  if (CRON_SECRET) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now = new Date()

  const dueInvoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['sent', 'overdue'] },
      reminder_count: { lt: MAX_REMINDERS },
      next_reminder: { lte: now },
    },
    include: {
      customer: true,
      user: {
        select: { company_name: true, phone: true },
      },
    },
  })

  if (dueInvoices.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let sent = 0
  let failed = 0

  for (const invoice of dueInvoices) {
    if (!invoice.customer?.email) {
      // No email — clear next_reminder so we don't keep retrying
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { next_reminder: null },
      })
      continue
    }

    const newCount = invoice.reminder_count + 1
    const nextReminder = newCount < MAX_REMINDERS
      ? new Date(now.getTime() + REMINDER_INTERVAL_DAYS * 86400000)
      : null

    // Permanent URL — generates a fresh Checkout Session on demand, never expires
    const paymentLink = invoice.public_token
      ? `${APP_URL}/pay/${invoice.public_token}`
      : null

    try {
      await sendInvoiceReminderEmail({
        to: invoice.customer.email,
        customerName: invoice.customer.name,
        companyName: invoice.user.company_name,
        companyPhone: invoice.user.phone,
        invoiceNumber: invoice.invoice_number,
        total: invoice.total.toNumber(),
        dueDate: invoice.due_date?.toISOString() ?? null,
        paymentLink,
        reminderNumber: newCount,
      })

      await prisma.$transaction([
        prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            reminder_count: newCount,
            next_reminder: nextReminder,
          },
        }),
        prisma.activityEvent.create({
          data: {
            user_id: invoice.user_id,
            invoice_id: invoice.id,
            event_type: 'invoice_reminder',
            metadata: {
              invoice_number: invoice.invoice_number,
              customer_name: invoice.customer.name,
              reminder_number: newCount,
              total: invoice.total.toNumber(),
            },
          },
        }),
      ])

      sent++
    } catch (err) {
      console.error(`[invoice-reminders] Failed for invoice ${invoice.invoice_number}:`, err)
      failed++
    }
  }

  return NextResponse.json({ processed: dueInvoices.length, sent, failed })
}
