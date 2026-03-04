import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const { id } = await params

  // Verify customer belongs to user
  const customer = await prisma.customer.findFirst({
    where: { id, user_id: user.id },
    select: { id: true },
  })

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  // Transactional delete: remove related records that lack onDelete: Cascade
  await prisma.$transaction(async (tx) => {
    // Null out customer_id on voice_calls (no FK constraint, just a reference)
    await tx.voiceCall.updateMany({
      where: { customer_id: id },
      data: { customer_id: null },
    })

    // Delete invoices (line items cascade via onDelete: Cascade on InvoiceLineItem)
    await tx.invoice.deleteMany({ where: { customer_id: id } })

    // Delete quotes (line items cascade via onDelete: Cascade on QuoteLineItem)
    await tx.quote.deleteMany({ where: { customer_id: id } })

    // Delete customer (jobs cascade via onDelete: Cascade on Job)
    await tx.customer.delete({ where: { id } })
  })

  return NextResponse.json({ success: true })
}
