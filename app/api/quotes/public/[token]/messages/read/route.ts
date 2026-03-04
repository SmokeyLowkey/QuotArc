import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const quote = await prisma.quote.findUnique({
    where: { public_token: token },
    select: { id: true },
  })

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  // Mark all outbound messages without read_at as read by customer
  const { count } = await prisma.quoteMessage.updateMany({
    where: {
      quote_id: quote.id,
      direction: 'outbound',
      channel: 'portal',
      read_at: null,
    },
    data: {
      read_at: new Date(),
    },
  })

  return NextResponse.json({ marked: count })
}
