import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { QuoteViewClient } from './client'

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Fetch quote by public token with related data
  const quote = await prisma.quote.findUnique({
    where: { public_token: token },
    include: {
      customer: {
        select: { name: true, address: true, email: true, phone: true },
      },
      line_items: {
        orderBy: { sort_order: 'asc' },
      },
    },
  })

  if (!quote) return notFound()

  // Fetch company profile
  const profile = await prisma.profile.findUnique({
    where: { id: quote.user_id },
    select: { company_name: true, phone: true, address: true },
  })

  // Serialize Decimal fields for client component
  const serializedQuote = {
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

  return (
    <div className="min-h-dvh bg-gray-100 py-8 px-4">
      <QuoteViewClient
        token={token}
        quote={serializedQuote}
        profile={profile}
        alreadyViewed={!!quote.viewed_at}
      />
    </div>
  )
}
