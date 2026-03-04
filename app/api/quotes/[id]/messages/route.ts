import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'
import { sendNewMessageNotification } from '@/lib/email'

export async function GET(
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

  // Verify user owns this quote
  const quote = await prisma.quote.findFirst({
    where: { id, user_id: user.id },
    select: { id: true },
  })

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  // Fetch messages and activity events for the timeline
  const [messages, events] = await Promise.all([
    prisma.quoteMessage.findMany({
      where: { quote_id: id },
      orderBy: { created_at: 'asc' },
    }),
    prisma.activityEvent.findMany({
      where: { quote_id: id },
      orderBy: { created_at: 'asc' },
    }),
  ])

  return NextResponse.json({ messages, events })
}

export async function POST(
  request: NextRequest,
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
  const { body, channel, message_type, attachments, metadata } = await request.json() as {
    body: string
    channel: 'portal' | 'note'
    message_type?: 'text' | 'image' | 'file' | 'quote_card' | 'invoice_card'
    attachments?: { url: string; name: string; type: string; size: number }[]
    metadata?: Record<string, unknown>
  }

  const hasAttachments = attachments && attachments.length > 0
  if (!body?.trim() && !hasAttachments && message_type !== 'quote_card' && message_type !== 'invoice_card') {
    return NextResponse.json({ error: 'Message body or attachments required' }, { status: 400 })
  }

  // Fetch quote with customer for notification data
  const quote = await prisma.quote.findFirst({
    where: { id, user_id: user.id },
    include: { customer: true },
  })

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { company_name: true, phone: true },
  })

  const companyName = profile?.company_name || 'Your electrician'

  // Create message + activity event in a transaction
  const message = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const msg = await tx.quoteMessage.create({
      data: {
        quote_id: id,
        user_id: user.id,
        direction: 'outbound',
        channel,
        message_type: message_type || 'text',
        body: body?.trim() || '',
        sender_name: companyName,
        attachments: (attachments || []) as Prisma.InputJsonValue,
        metadata: (metadata || {}) as Prisma.InputJsonValue,
        is_read: true, // Outbound messages are always "read" by the sender
      },
    })

    // Only create activity event for portal messages (not internal notes)
    if (channel === 'portal') {
      await tx.activityEvent.create({
        data: {
          user_id: user.id,
          quote_id: id,
          event_type: 'message_sent',
          metadata: {
            customer_name: quote.customer?.name,
            quote_number: quote.quote_number,
          },
        },
      })
    }

    return msg
  })

  // Send notification email to customer (fire-and-forget, portal messages only)
  if (channel === 'portal' && quote.customer?.email && body?.trim()) {
    try {
      await sendNewMessageNotification({
        to: quote.customer.email,
        customerName: quote.customer.name,
        companyName,
        companyPhone: profile?.phone,
        previewText: body.trim().substring(0, 150),
        chatUrl: `${process.env.NEXT_PUBLIC_APP_URL}/q/${quote.public_token}/chat`,
      })
    } catch (err) {
      console.error('Failed to send message notification email:', err)
    }
  }

  return NextResponse.json(message, { status: 201 })
}
