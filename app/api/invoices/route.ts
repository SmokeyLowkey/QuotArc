import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'
import { parsePaginationParams, buildPaginationMeta } from '@/lib/pagination'
import type { LineItemCategory } from '@/lib/types'

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

export async function GET(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const { searchParams } = new URL(request.url)
  const { page, limit, skip } = parsePaginationParams(searchParams)

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [invoices, total, statsData] = await Promise.all([
    prisma.invoice.findMany({
      where: { user_id: user.id },
      include: {
        customer: true,
        line_items: { orderBy: { sort_order: 'asc' } },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.invoice.count({ where: { user_id: user.id } }),
    prisma.invoice.findMany({
      where: { user_id: user.id },
      select: { status: true, total: true, paid_at: true },
    }),
  ])

  type StatItem = { status: string; total: { toNumber: () => number }; paid_at: Date | null }
  const stats = statsData as StatItem[]

  const outstanding = stats
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((s, i) => s + (i.total as { toNumber: () => number }).toNumber(), 0)
  const overdue = stats
    .filter(i => i.status === 'overdue')
    .reduce((s, i) => s + (i.total as { toNumber: () => number }).toNumber(), 0)
  const overdueCount = stats.filter(i => i.status === 'overdue').length
  const collectedThisMonth = stats
    .filter(i => {
      if (i.status !== 'paid' || !i.paid_at) return false
      return new Date(i.paid_at) >= startOfMonth
    })
    .reduce((s, i) => s + (i.total as { toNumber: () => number }).toNumber(), 0)

  return NextResponse.json({
    invoices: invoices.map((inv: unknown) => serializeInvoice(inv as Record<string, unknown>)),
    stats: { outstanding, overdue, overdueCount, collectedThisMonth },
    pagination: buildPaginationMeta(total, page, limit),
  })
}

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const body = await request.json()

  // Idempotency: if creating from a quote, return existing invoice if one already exists
  if (body.quote_id) {
    const existing = await prisma.invoice.findFirst({
      where: { quote_id: body.quote_id, user_id: user.id },
      include: {
        customer: true,
        line_items: { orderBy: { sort_order: 'asc' } },
      },
    })
    if (existing) {
      return NextResponse.json(serializeInvoice(existing as unknown as Record<string, unknown>))
    }
  }

  // Generate sequential invoice number
  const lastInvoice = await prisma.invoice.findFirst({
    where: { user_id: user.id },
    orderBy: { created_at: 'desc' },
    select: { invoice_number: true },
  })

  const lastNum = lastInvoice?.invoice_number
    ? parseInt(lastInvoice.invoice_number.replace('INV-', ''), 10)
    : 0
  const invoiceNumber = `INV-${String(lastNum + 1).padStart(4, '0')}`

  // Get user's tax rate
  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { default_tax_rate: true, company_name: true },
  })

  const taxRate = body.tax_rate ?? profile?.default_tax_rate?.toNumber() ?? 0.05

  // If creating from a quote, copy line items from quote
  let lineItems: Array<{
    description: string
    category: LineItemCategory
    quantity: number
    unit: string
    rate: number
    total: number
    sort_order: number
  }> = []

  if (body.quote_id) {
    const quote = await prisma.quote.findFirst({
      where: { id: body.quote_id, user_id: user.id },
      include: { line_items: { orderBy: { sort_order: 'asc' } } },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    lineItems = quote.line_items.map((li: (typeof quote.line_items)[number], index: number) => ({
      description: li.description,
      category: li.category as LineItemCategory,
      quantity: li.quantity.toNumber(),
      unit: li.unit,
      rate: li.rate.toNumber(),
      total: li.total.toNumber(),
      sort_order: index,
    }))
  }

  // Allow body to override line items (for manual creation)
  if (body.line_items?.length > 0) {
    lineItems = body.line_items.map((item: Record<string, unknown>, index: number) => ({
      description: item.description as string,
      category: ((item.category as string) || 'material') as LineItemCategory,
      quantity: Number(item.quantity) || 1,
      unit: (item.unit as string) || 'ea',
      rate: Number(item.rate) || 0,
      total: (Number(item.quantity) || 1) * (Number(item.rate) || 0),
      sort_order: index,
    }))
  }

  const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0)
  const tax = Math.round(subtotal * taxRate * 100) / 100
  const total = subtotal + tax

  // Default due date: 14 days from now
  const dueDate = body.due_date || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const invoice = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.invoice.create({
      data: {
        user_id: user.id,
        customer_id: body.customer_id,
        quote_id: body.quote_id || null,
        invoice_number: invoiceNumber,
        status: 'draft',
        subtotal,
        tax_rate: taxRate,
        tax,
        total,
        due_date: new Date(dueDate),
        line_items: lineItems.length > 0
          ? { create: lineItems }
          : undefined,
      },
      include: {
        customer: true,
        line_items: { orderBy: { sort_order: 'asc' } },
      },
    })

    await tx.activityEvent.create({
      data: {
        user_id: user.id,
        quote_id: body.quote_id || null,
        invoice_id: created.id,
        event_type: 'invoice_sent',
        metadata: {
          invoice_number: invoiceNumber,
          total,
          from_quote: !!body.quote_id,
        },
      },
    })

    // Create a chat message on the quote timeline so the invoice is visible there
    if (body.quote_id) {
      const companyName = profile?.company_name || 'Your electrician'
      await tx.quoteMessage.create({
        data: {
          quote_id: body.quote_id,
          user_id: user.id,
          direction: 'outbound',
          channel: 'portal',
          message_type: 'invoice_card',
          body: '',
          sender_name: companyName,
          attachments: [] as unknown as Prisma.InputJsonValue,
          metadata: {
            invoice_id: created.id,
            invoice_number: invoiceNumber,
            total,
            status: 'draft',
          } as unknown as Prisma.InputJsonValue,
          is_read: true,
        },
      })
    }

    return created
  })

  return NextResponse.json(serializeInvoice(invoice as unknown as Record<string, unknown>))
}
