import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendQuoteAcceptedNotification } from '@/lib/email'

// Max size for signature data URL (~50KB)
const MAX_SIGNATURE_SIZE = 50_000

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Parse body — expects JSON with signature data
  let body: { signature_data?: string; signature_name?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }

  const { signature_data, signature_name } = body

  // Validate signature fields
  if (!signature_data || typeof signature_data !== 'string') {
    return NextResponse.json(
      { error: 'Signature is required' },
      { status: 400 }
    )
  }

  if (!signature_data.startsWith('data:image/png;base64,')) {
    return NextResponse.json(
      { error: 'Invalid signature format' },
      { status: 400 }
    )
  }

  if (signature_data.length > MAX_SIGNATURE_SIZE) {
    return NextResponse.json(
      { error: 'Signature data too large' },
      { status: 400 }
    )
  }

  if (!signature_name || typeof signature_name !== 'string' || !signature_name.trim()) {
    return NextResponse.json(
      { error: 'Full name is required' },
      { status: 400 }
    )
  }

  // Extract IP and user agent
  const signer_ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const signer_user_agent = request.headers.get('user-agent') || 'unknown'

  // Fetch quote by public token
  const quote = await prisma.quote.findUnique({
    where: { public_token: token },
    select: {
      id: true,
      user_id: true,
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

  // Can only accept sent or viewed quotes
  if (!['sent', 'viewed'].includes(quote.status)) {
    return NextResponse.json({ error: 'Quote cannot be accepted' }, { status: 400 })
  }

  const now = new Date()

  // Fetch customer + owner profile
  const [customer, profile] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: quote.customer_id },
      select: { name: true, email: true },
    }),
    prisma.profile.findUnique({
      where: { id: quote.user_id },
      select: { company_name: true, email: true },
    }),
  ])

  // Update quote + insert activity event in transaction
  await prisma.$transaction([
    prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: 'accepted',
        accepted_at: now,
        next_follow_up: null,
        // E-signature fields
        signature_data: signature_data,
        signature_name: signature_name.trim(),
        signer_ip,
        signer_user_agent,
        signed_at: now,
      },
    }),
    prisma.activityEvent.create({
      data: {
        user_id: quote.user_id,
        quote_id: quote.id,
        event_type: 'quote_accepted',
        metadata: {
          customer_name: customer?.name,
          quote_number: quote.quote_number,
          job_type: quote.job_type,
          total: quote.total.toNumber(),
          signed_by: signature_name.trim(),
        },
      },
    }),
    prisma.notification.create({
      data: {
        user_id: quote.user_id,
        type: 'quote_accepted',
        title: 'Quote accepted!',
        body: `${customer?.name || 'Customer'} accepted ${quote.quote_number}`,
        link_url: `/quotes/${quote.id}`,
        metadata: { customer_name: customer?.name, quote_number: quote.quote_number },
      },
    }),
  ])

  // Notify electrician via email (fire-and-forget)
  if (profile?.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    try {
      await sendQuoteAcceptedNotification({
        to: profile.email,
        customerName: customer?.name || 'Customer',
        quoteNumber: quote.quote_number,
        jobType: quote.job_type,
        total: quote.total.toNumber(),
        dashboardUrl: `${appUrl}/quotes/${quote.id}`,
      })
    } catch (err) {
      console.error('Failed to send quote-accepted email:', err)
    }
  }

  return NextResponse.json({ success: true })
}
