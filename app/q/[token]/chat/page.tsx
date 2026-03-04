import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ChatPortalClient } from './client'

export default async function ChatPortalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const quote = await prisma.quote.findUnique({
    where: { public_token: token },
    select: {
      id: true,
      quote_number: true,
      job_type: true,
      status: true,
      public_token: true,
      customer: { select: { name: true } },
      user: { select: { company_name: true, phone: true, logo_url: true } },
    },
  })

  if (!quote) return notFound()

  return (
    <div className="min-h-dvh bg-gray-100 flex flex-col">
      <ChatPortalClient
        token={token}
        quoteNumber={quote.quote_number}
        jobType={quote.job_type}
        status={quote.status}
        customerName={quote.customer?.name || 'Customer'}
        companyName={quote.user?.company_name || 'Company'}
        companyPhone={quote.user?.phone || null}
      />
    </div>
  )
}
