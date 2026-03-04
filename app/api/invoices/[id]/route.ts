import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'

function serializeInvoice(inv: Record<string, unknown>) {
  const raw = inv as Record<string, unknown>
  return {
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
  }
}

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

  const invoice = await prisma.invoice.findFirst({
    where: { id, user_id: user.id },
    include: {
      customer: true,
      line_items: { orderBy: { sort_order: 'asc' } },
      quote: { select: { id: true, quote_number: true, job_type: true } },
    },
  })

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  return NextResponse.json(serializeInvoice(invoice as unknown as Record<string, unknown>))
}

export async function PATCH(
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
  const body = await request.json()

  // Verify ownership
  const existing = await prisma.invoice.findFirst({
    where: { id, user_id: user.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // If line_items are provided, replace them all (delete + recreate)
  if (body.line_items) {
    await prisma.invoiceLineItem.deleteMany({ where: { invoice_id: id } })

    const lineItems = body.line_items.map((item: Record<string, unknown>, index: number) => ({
      invoice_id: id,
      description: item.description as string,
      category: (item.category as string) || 'material',
      quantity: Number(item.quantity) || 1,
      unit: (item.unit as string) || 'ea',
      rate: Number(item.rate) || 0,
      total: (Number(item.quantity) || 1) * (Number(item.rate) || 0),
      sort_order: index,
    }))

    await prisma.invoiceLineItem.createMany({ data: lineItems })

    // Recalculate totals
    const subtotal = lineItems.reduce((sum: number, li: { total: number }) => sum + li.total, 0)
    const taxRate = body.tax_rate ?? existing.tax_rate.toNumber()
    const tax = Math.round(subtotal * taxRate * 100) / 100
    const total = subtotal + tax

    body.subtotal = subtotal
    body.tax_rate = taxRate
    body.tax = tax
    body.total = total
    delete body.line_items
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      ...(body.status && { status: body.status }),
      ...(body.due_date && { due_date: new Date(body.due_date) }),
      ...(body.subtotal !== undefined && { subtotal: body.subtotal }),
      ...(body.tax_rate !== undefined && { tax_rate: body.tax_rate }),
      ...(body.tax !== undefined && { tax: body.tax }),
      ...(body.total !== undefined && { total: body.total }),
      ...(body.paid_at && { paid_at: new Date(body.paid_at) }),
    },
    include: {
      customer: true,
      line_items: { orderBy: { sort_order: 'asc' } },
    },
  })

  return NextResponse.json(serializeInvoice(updated as unknown as Record<string, unknown>))
}

export async function DELETE(
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

  const existing = await prisma.invoice.findFirst({
    where: { id, user_id: user.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  await prisma.invoice.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
