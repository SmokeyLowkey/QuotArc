import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'

export async function PATCH(
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

  // Mark all unread inbound messages as read
  const { count } = await prisma.quoteMessage.updateMany({
    where: {
      quote_id: id,
      direction: 'inbound',
      is_read: false,
    },
    data: {
      is_read: true,
      read_at: new Date(),
    },
  })

  return NextResponse.json({ marked: count })
}
