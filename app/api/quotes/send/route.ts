import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'
import { sendQuoteEmail } from '@/lib/email'
import { generateQuotePdf } from '@/lib/pdf'

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const { quoteId } = await request.json()

  // Fetch quote with customer + line items
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, user_id: user.id },
    include: {
      customer: true,
      line_items: { orderBy: { sort_order: 'asc' } },
    },
  })

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  if (!quote.customer?.email) {
    return NextResponse.json(
      { error: 'Customer has no email address. Add an email before sending.' },
      { status: 400 },
    )
  }

  // Fetch profile for company info + plan tier
  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { company_name: true, phone: true, address: true, plan_tier: true, logo_url: true },
  })

  // ── Free trial: 10 sent quotes lifetime cap ──────────────────
  if (profile?.plan_tier === 'free') {
    const totalSent = await prisma.quote.count({
      where: { user_id: user.id, sent_at: { not: null } },
    })
    if (totalSent >= 10) {
      return NextResponse.json(
        { error: 'Free trial limit reached. Upgrade to send more quotes.', limit: 10 },
        { status: 403 },
      )
    }
  }

  const now = new Date()
  const nextFollowUp = quote.auto_follow_up
    ? new Date(Date.now() + quote.follow_up_days * 86400000)
    : null

  const companyName = profile?.company_name || 'Your electrician'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Update quote status + insert activity event + auto-insert quote card message
  await prisma.$transaction([
    prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: 'sent',
        sent_at: now,
        next_follow_up: nextFollowUp,
        delivery_status: 'pending',
      },
    }),
    prisma.activityEvent.create({
      data: {
        user_id: user.id,
        quote_id: quoteId,
        event_type: 'quote_sent',
        metadata: {
          customer_name: quote.customer?.name,
          total: quote.total.toNumber(),
          job_type: quote.job_type,
          quote_number: quote.quote_number,
        },
      },
    }),
    // Auto-insert a rich quote card into the chat
    prisma.quoteMessage.create({
      data: {
        quote_id: quoteId,
        user_id: user.id,
        direction: 'outbound',
        channel: 'portal',
        message_type: 'quote_card',
        body: '',
        sender_name: companyName,
        is_read: true,
        metadata: {
          quote_id: quoteId,
          quote_number: quote.quote_number,
          job_type: quote.job_type,
          total: quote.total.toNumber(),
          status: 'sent',
        },
      },
    }),
  ])

  // Generate PDF and send email
  if (quote.customer?.email) {
    try {
      const pdfBuffer = await generateQuotePdf({
        companyName,
        companyPhone: profile?.phone,
        companyAddress: profile?.address,
        logoUrl: profile?.logo_url,
        quoteNumber: quote.quote_number,
        date: quote.created_at.toISOString(),
        customerName: quote.customer.name,
        customerAddress: quote.customer.address,
        customerEmail: quote.customer.email,
        jobType: quote.job_type,
        lineItems: quote.line_items.map((li: (typeof quote.line_items)[number]) => ({
          description: li.description,
          category: li.category,
          quantity: li.quantity.toNumber(),
          unit: li.unit,
          rate: li.rate.toNumber(),
          total: li.total.toNumber(),
        })),
        subtotal: quote.subtotal.toNumber(),
        taxRate: quote.tax_rate.toNumber(),
        tax: quote.tax.toNumber(),
        total: quote.total.toNumber(),
        customerNote: quote.customer_note,
        scopeNotes: quote.scope_notes,
      })

      const result = await sendQuoteEmail({
        to: quote.customer.email,
        customerName: quote.customer.name,
        companyName,
        companyPhone: profile?.phone,
        quoteNumber: quote.quote_number,
        jobType: quote.job_type,
        total: quote.total.toNumber(),
        customerNote: quote.customer_note,
        quoteUrl: `${baseUrl}/q/${quote.public_token}`,
        chatUrl: `${baseUrl}/q/${quote.public_token}/chat`,
        pdfBuffer,
      })

      if (result.error) {
        console.error('[quote-send] Resend error:', result.error)
        await prisma.quote.update({
          where: { id: quoteId },
          data: { delivery_status: 'failed' },
        })
      } else {
        await prisma.quote.update({
          where: { id: quoteId },
          data: { delivery_status: 'delivered' },
        })
      }
    } catch (err) {
      console.error('[quote-send] Failed to send quote email:', err)
      await prisma.quote.update({
        where: { id: quoteId },
        data: { delivery_status: 'failed' },
      })
    }
  }

  return NextResponse.json({ success: true })
}
