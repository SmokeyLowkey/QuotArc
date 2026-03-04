import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'
import { parsePaginationParams, buildPaginationMeta } from '@/lib/pagination'

function serializeQuote(q: Record<string, unknown>) {
  const invoices = q.invoices as Array<Record<string, unknown>> | undefined
  const firstInvoice = invoices?.[0]
  return {
    ...q,
    subtotal: (q.subtotal as { toNumber?: () => number })?.toNumber?.() ?? q.subtotal,
    tax_rate: (q.tax_rate as { toNumber?: () => number })?.toNumber?.() ?? q.tax_rate,
    tax: (q.tax as { toNumber?: () => number })?.toNumber?.() ?? q.tax,
    total: (q.total as { toNumber?: () => number })?.toNumber?.() ?? q.total,
    invoice: firstInvoice
      ? {
          ...firstInvoice,
          total: (firstInvoice.total as { toNumber?: () => number })?.toNumber?.() ?? firstInvoice.total,
        }
      : null,
    invoices: undefined,
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
  const status = searchParams.get('status') || undefined

  const baseWhere = { user_id: user.id }
  const listWhere = { ...baseWhere, ...(status && status !== 'all' ? { status } : {}) } as Prisma.QuoteWhereInput

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [quotes, total, sentThisMonth, viewedCount, acceptedCount, revenueAgg] = await Promise.all([
    prisma.quote.findMany({
      where: listWhere,
      include: {
        customer: { select: { name: true, address: true, email: true, phone: true } },
        invoices: {
          select: { id: true, invoice_number: true, status: true, total: true },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.quote.count({ where: listWhere }),
    prisma.quote.count({ where: { ...baseWhere, sent_at: { gte: startOfMonth } } }),
    prisma.quote.count({ where: { ...baseWhere, viewed_at: { not: null }, sent_at: { not: null } } }),
    prisma.quote.count({ where: { ...baseWhere, status: 'accepted', sent_at: { not: null } } }),
    prisma.quote.aggregate({
      where: { ...baseWhere, status: 'accepted' },
      _sum: { total: true },
    }),
  ])

  const allSentCount = await prisma.quote.count({ where: { ...baseWhere, sent_at: { not: null } } })

  const stats = {
    sentThisMonth,
    viewed: viewedCount,
    viewedRate: Math.round((viewedCount / Math.max(allSentCount, 1)) * 100),
    accepted: acceptedCount,
    acceptedRate: Math.round((acceptedCount / Math.max(allSentCount, 1)) * 100),
    revenueWon: revenueAgg._sum.total?.toNumber() ?? 0,
  }

  return NextResponse.json({
    quotes: quotes.map((q: (typeof quotes)[number]) => serializeQuote(q as unknown as Record<string, unknown>)),
    stats,
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

  // Generate sequential quote number
  const lastQuote = await prisma.quote.findFirst({
    where: { user_id: user.id },
    orderBy: { created_at: 'desc' },
    select: { quote_number: true },
  })

  const lastNum = lastQuote?.quote_number
    ? parseInt(lastQuote.quote_number.replace('Q-', ''), 10)
    : 0
  const quoteNumber = `Q-${String(lastNum + 1).padStart(4, '0')}`

  // Get user's tax rate
  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { default_tax_rate: true },
  })

  const taxRate = profile?.default_tax_rate?.toNumber() ?? 0.05
  const subtotal = Number(body.subtotal) || 0
  const tax = Math.round(subtotal * taxRate * 100) / 100
  const total = subtotal + tax

  // Create quote with line items in a transaction
  const quote = await prisma.quote.create({
    data: {
      user_id: user.id,
      customer_id: body.customer_id,
      quote_number: quoteNumber,
      status: body.status || 'draft',
      job_type: body.job_type,
      scope_notes: body.scope_notes || null,
      subtotal,
      tax_rate: taxRate,
      tax,
      total,
      auto_follow_up: body.auto_follow_up ?? true,
      follow_up_days: body.follow_up_days ?? 3,
      customer_note: body.customer_note || null,
      code_notes: body.code_notes || null,
      line_items: body.line_items?.length > 0
        ? {
            create: body.line_items.map((item: Record<string, unknown>, index: number) => ({
              description: item.description as string,
              category: (item.category as string) || 'material',
              quantity: Number(item.quantity) || 1,
              unit: (item.unit as string) || 'ea',
              rate: Number(item.rate) || 0,
              total: (Number(item.quantity) || 1) * (Number(item.rate) || 0),
              is_template_item: (item.is_template_item as boolean) || false,
              sort_order: index,
            })),
          }
        : undefined,
    },
  })

  // If a job_id was provided (e.g. from the AI receptionist path), link the
  // unlinked job to this quote so both records are connected.
  if (body.job_id) {
    await prisma.job.updateMany({
      where: { id: body.job_id, user_id: user.id, quote_id: null },
      data: { quote_id: quote.id },
    })
  }

  return NextResponse.json({
    ...quote,
    subtotal: quote.subtotal.toNumber(),
    tax_rate: quote.tax_rate.toNumber(),
    tax: quote.tax.toNumber(),
    total: quote.total.toNumber(),
  })
}
