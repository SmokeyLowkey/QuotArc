'use client'

import { useState, useEffect } from 'react'
import { QuoteDocument } from '@/components/quote-document'

interface QuoteViewClientProps {
  token: string
  quote: Record<string, unknown>
  profile: Record<string, unknown> | null
  alreadyViewed: boolean
}

export function QuoteViewClient({ token, quote, profile, alreadyViewed }: QuoteViewClientProps) {
  const [status, setStatus] = useState(quote.status as string)
  const [signLoading, setSignLoading] = useState(false)
  const [signatureData, setSignatureData] = useState<string | null>(
    (quote.signature_data as string) || null
  )
  const [signatureName, setSignatureName] = useState<string | null>(
    (quote.signature_name as string) || null
  )
  const [signedAt, setSignedAt] = useState<string | null>(
    (quote.signed_at as string) || null
  )

  // Track view on mount
  useEffect(() => {
    if (!alreadyViewed) {
      fetch(`/api/quotes/public/${token}/view`, { method: 'POST' }).catch(() => {})
    }
  }, [token, alreadyViewed])

  const handleSign = async (data: { signatureData: string; signatureName: string }) => {
    setSignLoading(true)
    try {
      const res = await fetch(`/api/quotes/public/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_data: data.signatureData,
          signature_name: data.signatureName,
        }),
      })
      if (res.ok) {
        setStatus('accepted')
        setSignatureData(data.signatureData)
        setSignatureName(data.signatureName)
        setSignedAt(new Date().toISOString())
      }
    } finally {
      setSignLoading(false)
    }
  }

  const lineItems = (quote.line_items as Record<string, unknown>[]) || []
  const customer = quote.customer as Record<string, unknown> | null

  const formattedDate = new Date(quote.created_at as string).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <QuoteDocument
      companyName={(profile?.company_name as string) || 'Company'}
      companyPhone={profile?.phone as string | null}
      companyAddress={profile?.address as string | null}
      quoteNumber={quote.quote_number as string}
      date={formattedDate}
      customerName={(customer?.name as string) || 'Customer'}
      customerAddress={customer?.address as string | null}
      customerEmail={customer?.email as string | null}
      jobType={quote.job_type as string}
      lineItems={lineItems.map(li => ({
        description: li.description as string,
        category: li.category as string,
        quantity: Number(li.quantity),
        unit: li.unit as string,
        rate: Number(li.rate),
        total: Number(li.total),
      }))}
      subtotal={Number(quote.subtotal)}
      taxRate={Number(quote.tax_rate)}
      tax={Number(quote.tax)}
      total={Number(quote.total)}
      customerNote={quote.customer_note as string | null}
      scopeNotes={quote.scope_notes as string | null}
      codeNotes={quote.code_notes as { inspection: string[]; safety: string[]; technical: string[] } | null}
      status={status}
      onSign={handleSign}
      signLoading={signLoading}
      signatureData={signatureData}
      signatureName={signatureName}
      signedAt={signedAt}
    />
  )
}
