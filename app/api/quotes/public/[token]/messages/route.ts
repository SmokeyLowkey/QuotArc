import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { sendCustomerReplyNotification } from '@/lib/email'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const quote = await prisma.quote.findUnique({
    where: { public_token: token },
    select: { id: true, status: true },
  })

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  // Only return portal messages (not internal notes)
  const messages = await prisma.quoteMessage.findMany({
    where: { quote_id: quote.id, channel: 'portal' },
    orderBy: { created_at: 'asc' },
  })

  return NextResponse.json({ messages })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const { body, attachments } = await request.json() as {
    body: string
    attachments?: { url: string; name: string; type: string; size: number }[]
  }

  const hasAttachments = attachments && attachments.length > 0
  if (!body?.trim() && !hasAttachments) {
    return NextResponse.json({ error: 'Message body or attachments required' }, { status: 400 })
  }

  const quote = await prisma.quote.findUnique({
    where: { public_token: token },
    include: {
      customer: { select: { name: true } },
      user: { select: { email: true, company_name: true } },
    },
  })

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  if (quote.status === 'expired') {
    return NextResponse.json({ error: 'This quote has expired' }, { status: 410 })
  }

  const customerName = quote.customer?.name || 'Customer'

  // Create message + activity event
  const message = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Determine message type from attachments
    const msgType = hasAttachments
      ? (attachments![0].type.startsWith('image/') ? 'image' : 'file')
      : 'text'

    const msg = await tx.quoteMessage.create({
      data: {
        quote_id: quote.id,
        user_id: quote.user_id,
        direction: 'inbound',
        channel: 'portal',
        message_type: msgType as 'text' | 'image' | 'file',
        body: body?.trim() || '',
        sender_name: customerName,
        attachments: attachments || [],
        is_read: false,
      },
    })

    await tx.activityEvent.create({
      data: {
        user_id: quote.user_id,
        quote_id: quote.id,
        event_type: 'customer_replied',
        metadata: {
          customer_name: customerName,
          quote_number: quote.quote_number,
        },
      },
    })

    await tx.notification.create({
      data: {
        user_id: quote.user_id,
        type: 'customer_replied',
        title: `New message from ${customerName}`,
        body: `Reply on ${quote.quote_number}`,
        link_url: `/quotes/${quote.id}?tab=communication`,
        metadata: { customer_name: customerName, quote_number: quote.quote_number },
      },
    })

    return msg
  })

  // Notify electrician via email (fire-and-forget)
  if (quote.user?.email && body?.trim()) {
    try {
      await sendCustomerReplyNotification({
        to: quote.user.email,
        customerName,
        quoteNumber: quote.quote_number,
        previewText: body.trim().substring(0, 150),
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/quotes/${quote.id}`,
      })
    } catch (err) {
      console.error('Failed to send reply notification email:', err)
    }
  }

  return NextResponse.json(message, { status: 201 })
}
