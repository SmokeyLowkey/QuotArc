import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'

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

  const quote = await prisma.quote.findFirst({
    where: { id, user_id: user.id },
    include: {
      customer: true,
      line_items: { orderBy: { sort_order: 'asc' } },
      jobs: { select: { id: true, status: true, scheduled_date: true, start_time: true } },
    },
  })

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  // Serialize Decimal fields
  const serialized = {
    ...quote,
    subtotal: quote.subtotal.toNumber(),
    tax_rate: quote.tax_rate.toNumber(),
    tax: quote.tax.toNumber(),
    total: quote.total.toNumber(),
    line_items: quote.line_items.map((item: (typeof quote.line_items)[number]) => ({
      ...item,
      quantity: item.quantity.toNumber(),
      rate: item.rate.toNumber(),
      total: item.total.toNumber(),
    })),
  }

  return NextResponse.json(serialized)
}
