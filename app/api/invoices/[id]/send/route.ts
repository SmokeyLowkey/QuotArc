import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'
import { sendInvoiceEmail } from '@/lib/email'
import { generateInvoicePdf } from '@/lib/pdf'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const { id } = await params

  const invoice = await prisma.invoice.findFirst({
    where: { id, user_id: user.id },
    include: {
      customer: true,
      line_items: { orderBy: { sort_order: 'asc' } },
    },
  })

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  if (invoice.status !== 'draft') {
    return NextResponse.json({ error: 'Invoice already sent' }, { status: 400 })
  }

  // Mark as sent — schedule first reminder 3 days from now
  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      status: 'sent',
      sent_at: new Date(),
      next_reminder: new Date(Date.now() + 3 * 86400000),
    },
    include: {
      customer: true,
      line_items: { orderBy: { sort_order: 'asc' } },
    },
  })

  // Create activity event
  await prisma.activityEvent.create({
    data: {
      user_id: user.id,
      invoice_id: id,
      quote_id: invoice.quote_id,
      event_type: 'invoice_sent',
      metadata: {
        invoice_number: invoice.invoice_number,
        total: invoice.total.toNumber(),
        customer_name: invoice.customer.name,
      },
    },
  })

  // Fetch profile (needed for both the chat message and email)
  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: {
      company_name: true,
      phone: true,
      address: true,
      logo_url: true,
      stripe_account_id: true,
      stripe_onboarding_complete: true,
    },
  })

  // Create a chat message on the quote timeline showing the invoice was sent
  if (invoice.quote_id) {
    const companyName = profile?.company_name || 'Your electrician'
    await prisma.quoteMessage.create({
      data: {
        quote_id: invoice.quote_id,
        user_id: user.id,
        direction: 'outbound',
        channel: 'portal',
        message_type: 'invoice_card',
        body: '',
        sender_name: companyName,
        attachments: [] as unknown as Prisma.InputJsonValue,
        metadata: {
          invoice_id: id,
          invoice_number: invoice.invoice_number,
          total: invoice.total.toNumber(),
          status: 'sent',
        } as unknown as Prisma.InputJsonValue,
        is_read: true,
      },
    })
  }

  // Send email via Resend
  if (invoice.customer.email) {

    // Permanent pay URL — creates a fresh Stripe Checkout Session on demand,
    // so the customer can always pay regardless of when they open the email.
    const paymentLink = invoice.public_token
      ? `${APP_URL}/pay/${invoice.public_token}`
      : null

    const lineItemsSummary = invoice.line_items
      .map((li: { description: string; quantity: { toNumber: () => number }; total: { toNumber: () => number } }) => `${li.description} × ${li.quantity.toNumber()} — $${li.total.toNumber().toFixed(2)}`)
      .join('<br/>')

    try {
      const pdfBuffer = await generateInvoicePdf({
        companyName: profile?.company_name || 'QuotArc',
        companyPhone: profile?.phone,
        companyAddress: profile?.address,
        logoUrl: profile?.logo_url,
        invoiceNumber: invoice.invoice_number,
        date: invoice.created_at.toISOString(),
        dueDate: invoice.due_date?.toISOString() || null,
        customerName: invoice.customer.name,
        customerAddress: invoice.customer.address,
        customerEmail: invoice.customer.email,
        lineItems: invoice.line_items.map((li: { description: string; category: string; quantity: { toNumber: () => number }; unit: string; rate: { toNumber: () => number }; total: { toNumber: () => number } }) => ({
          description: li.description,
          category: li.category,
          quantity: li.quantity.toNumber(),
          unit: li.unit,
          rate: li.rate.toNumber(),
          total: li.total.toNumber(),
        })),
        subtotal: invoice.subtotal.toNumber(),
        taxRate: invoice.tax_rate.toNumber(),
        tax: invoice.tax.toNumber(),
        total: invoice.total.toNumber(),
      })

      await sendInvoiceEmail({
        to: invoice.customer.email,
        customerName: invoice.customer.name,
        companyName: profile?.company_name || 'QuotArc',
        companyPhone: profile?.phone,
        invoiceNumber: invoice.invoice_number,
        total: invoice.total.toNumber(),
        dueDate: invoice.due_date?.toISOString() || null,
        lineItemsSummary,
        pdfBuffer,
        paymentLink,
      })
    } catch (err) {
      console.error('[invoice-send] Failed to send invoice email:', err)
    }
  }

  const raw = updated as unknown as Record<string, unknown>
  return NextResponse.json({
    ...raw,
    subtotal: (raw.subtotal as { toNumber?: () => number })?.toNumber?.() ?? raw.subtotal,
    tax_rate: (raw.tax_rate as { toNumber?: () => number })?.toNumber?.() ?? raw.tax_rate,
    tax: (raw.tax as { toNumber?: () => number })?.toNumber?.() ?? raw.tax,
    total: (raw.total as { toNumber?: () => number })?.toNumber?.() ?? raw.total,
    line_items: Array.isArray(raw.line_items)
      ? (raw.line_items as Record<string, unknown>[]).map(li => ({
          ...li,
          quantity: (li.quantity as { toNumber?: () => number })?.toNumber?.() ?? li.quantity,
          rate: (li.rate as { toNumber?: () => number })?.toNumber?.() ?? li.rate,
          total: (li.total as { toNumber?: () => number })?.toNumber?.() ?? li.total,
        }))
      : undefined,
  })
}
