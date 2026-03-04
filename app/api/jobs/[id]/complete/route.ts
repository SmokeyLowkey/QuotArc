import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'
import type { LineItemCategory } from '@/lib/types'

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
  const { actual_hours, notes } = await request.json()

  const job = await prisma.job.findFirst({
    where: { id, user_id: user.id },
    include: {
      quote: { include: { line_items: { orderBy: { sort_order: 'asc' } } } },
    },
  })

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const updated = await tx.job.update({
      where: { id },
      data: {
        status: 'completed',
        actual_hours: actual_hours ?? null,
        notes: notes ?? job.notes,
        updated_at: new Date(),
      },
    })

    let invoice: { id: string; invoice_number: string; total: number } | null = null

    if (job.quote_id && job.quote) {
      // Return existing invoice if one already exists for this quote (avoid duplicates)
      const existing = await tx.invoice.findFirst({
        where: { quote_id: job.quote_id, user_id: user.id },
        select: { id: true, invoice_number: true, total: true },
      })

      if (existing) {
        invoice = {
          id: existing.id,
          invoice_number: existing.invoice_number,
          total: (existing.total as unknown as { toNumber: () => number }).toNumber(),
        }
      } else {
        // Generate next invoice number
        const lastInvoice = await tx.invoice.findFirst({
          where: { user_id: user.id },
          orderBy: { created_at: 'desc' },
          select: { invoice_number: true },
        })
        const lastNum = lastInvoice?.invoice_number
          ? parseInt(lastInvoice.invoice_number.replace('INV-', ''), 10)
          : 0
        const invoiceNumber = `INV-${String(lastNum + 1).padStart(4, '0')}`

        const profile = await tx.profile.findUnique({
          where: { id: user.id },
          select: { default_tax_rate: true },
        })
        const taxRate = profile?.default_tax_rate?.toNumber() ?? 0.05

        const lineItems = job.quote.line_items.map((li: (typeof job.quote.line_items)[number], index: number) => ({
          description: li.description,
          category: li.category as LineItemCategory,
          quantity: li.quantity.toNumber(),
          unit: li.unit,
          rate: li.rate.toNumber(),
          total: li.total.toNumber(),
          sort_order: index,
        }))

        const subtotal = lineItems.reduce((sum: number, li: (typeof lineItems)[number]) => sum + li.total, 0)
        const tax = Math.round(subtotal * taxRate * 100) / 100
        const total = subtotal + tax
        const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

        const created = await tx.invoice.create({
          data: {
            user_id: user.id,
            customer_id: job.customer_id,
            quote_id: job.quote_id,
            invoice_number: invoiceNumber,
            status: 'draft',
            subtotal,
            tax_rate: taxRate,
            tax,
            total,
            due_date: dueDate,
            line_items: lineItems.length > 0 ? { create: lineItems } : undefined,
          },
          select: { id: true, invoice_number: true, total: true },
        })

        await tx.activityEvent.create({
          data: {
            user_id: user.id,
            quote_id: job.quote_id,
            invoice_id: created.id,
            event_type: 'invoice_sent',
            metadata: {
              invoice_number: invoiceNumber,
              total,
              from_quote: true,
              auto_created: true,
            },
          },
        })

        invoice = {
          id: created.id,
          invoice_number: created.invoice_number,
          total: (created.total as unknown as { toNumber: () => number }).toNumber(),
        }
      }
    }

    return { updated, invoice }
  })

  return NextResponse.json({
    ...result.updated,
    invoice: result.invoice,
  })
}
