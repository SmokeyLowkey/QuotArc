'use client'

import { formatCurrency } from '@/lib/format'
import { SignaturePad } from '@/components/signature-pad'

import type { CodeNotes } from '@/lib/types'

interface QuoteDocumentProps {
  companyName: string
  companyPhone?: string | null
  companyAddress?: string | null
  quoteNumber: string
  date: string
  customerName: string
  customerAddress?: string | null
  customerEmail?: string | null
  jobType: string
  lineItems: {
    description: string
    category: string
    quantity: number
    unit: string
    rate: number
    total: number
  }[]
  subtotal: number
  taxRate: number
  tax: number
  total: number
  customerNote?: string | null
  scopeNotes?: string | null
  codeNotes?: CodeNotes | null
  status?: string
  onSign?: (data: { signatureData: string; signatureName: string }) => void
  signLoading?: boolean
  signatureData?: string | null
  signatureName?: string | null
  signedAt?: string | null
}

export function QuoteDocument({
  companyName,
  companyPhone,
  companyAddress,
  quoteNumber,
  date,
  customerName,
  customerAddress,
  customerEmail,
  jobType,
  lineItems,
  subtotal,
  taxRate,
  tax,
  total,
  customerNote,
  scopeNotes,
  codeNotes,
  status,
  onSign,
  signLoading,
  signatureData,
  signatureName,
  signedAt,
}: QuoteDocumentProps) {
  const canAccept = status === 'sent' || status === 'viewed'

  return (
    <div className="max-w-[720px] mx-auto bg-white text-gray-900 rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-900 text-white px-8 py-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[20px] font-bold">{companyName}</h1>
            {companyPhone && <p className="text-[13px] text-gray-400 mt-0.5">{companyPhone}</p>}
            {companyAddress && <p className="text-[13px] text-gray-400">{companyAddress}</p>}
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-gray-400">Quote</div>
            <div className="text-[18px] font-bold font-mono">{quoteNumber}</div>
            <div className="text-[12px] text-gray-400 mt-0.5">{date}</div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Customer + Job Info */}
        <div className="flex gap-8 mb-6">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Prepared for</div>
            <div className="text-[14px] font-semibold">{customerName}</div>
            {customerAddress && <div className="text-[13px] text-gray-600">{customerAddress}</div>}
            {customerEmail && <div className="text-[13px] text-gray-500">{customerEmail}</div>}
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Job Type</div>
            <div className="text-[14px] font-semibold">{jobType}</div>
          </div>
        </div>

        {/* Scope Notes */}
        {scopeNotes && (
          <div className="mb-6 p-3 bg-gray-50 rounded text-[13px] text-gray-700">
            <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Scope</div>
            {scopeNotes}
          </div>
        )}

        {/* Line Items Table */}
        <table className="w-full text-[13px] mb-6">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Description</th>
              <th className="text-right py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold w-16">Qty</th>
              <th className="text-right py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold w-20">Rate</th>
              <th className="text-right py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold w-24">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2">
                  <span>{item.description}</span>
                  {item.category !== 'material' && (
                    <span className="ml-1.5 text-[10px] uppercase text-gray-400">{item.category}</span>
                  )}
                </td>
                <td className="text-right py-2 font-mono text-gray-600">
                  {item.quantity} {item.unit !== 'ea' ? item.unit : ''}
                </td>
                <td className="text-right py-2 font-mono text-gray-600">{formatCurrency(item.rate)}</td>
                <td className="text-right py-2 font-mono font-medium">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-48">
            <div className="flex justify-between py-1 text-[13px] text-gray-600">
              <span>Subtotal</span>
              <span className="font-mono">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between py-1 text-[13px] text-gray-600">
              <span>Tax ({(taxRate * 100).toFixed(0)}%)</span>
              <span className="font-mono">{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between py-2 text-[16px] font-bold border-t-2 border-gray-900 mt-1">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Code Notes — show inspection & safety for customer awareness */}
        {codeNotes && (codeNotes.inspection?.length > 0 || codeNotes.safety?.length > 0) && (
          <div className="mb-6 space-y-3">
            {codeNotes.inspection?.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="text-[11px] uppercase tracking-wider text-blue-600 font-semibold mb-1.5">Inspection Requirements</div>
                <ul className="space-y-1">
                  {codeNotes.inspection.map((note, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-gray-700 leading-relaxed">
                      <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {codeNotes.safety?.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                <div className="text-[11px] uppercase tracking-wider text-amber-600 font-semibold mb-1.5">Safety Information</div>
                <ul className="space-y-1">
                  {codeNotes.safety.map((note, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-gray-700 leading-relaxed">
                      <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Customer Note */}
        {customerNote && (
          <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded text-[13px] text-gray-700">
            {customerNote}
          </div>
        )}

        {/* Accept & Sign */}
        {onSign && canAccept && (
          <div className="pt-4 pb-2 border-t border-gray-200 mt-4">
            <div className="text-center mb-4">
              <h3 className="text-[16px] font-semibold text-gray-900">
                Accept this quote
              </h3>
              <p className="text-[13px] text-gray-500 mt-1">
                Please sign below to accept the scope and pricing above.
              </p>
            </div>
            <SignaturePad onSubmit={onSign} loading={signLoading} />
          </div>
        )}

        {status === 'accepted' && (
          <div className="text-center py-4 space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-green-700 text-[14px] font-medium">
              Quote Accepted
            </div>
            {signatureData && (
              <div className="max-w-[300px] mx-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signatureData}
                  alt="Customer signature"
                  className="w-full border border-gray-200 rounded"
                />
                {signatureName && (
                  <p className="text-[13px] text-gray-600 mt-1">{signatureName}</p>
                )}
                {signedAt && (
                  <p className="text-[11px] text-gray-400">
                    Signed {new Date(signedAt).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'long', day: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {status === 'expired' && (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 text-[14px] font-medium">
              This quote has expired
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 text-center">
        <p className="text-[11px] text-gray-400">
          Powered by <span className="font-semibold">QuotArc</span>
        </p>
      </div>
    </div>
  )
}
