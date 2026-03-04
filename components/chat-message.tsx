'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { StickyNote, Check, CheckCheck } from 'lucide-react'
import { AttachmentPreview } from '@/components/attachment-preview'
import { ImageLightbox } from '@/components/image-lightbox'
import { RichQuoteCard } from '@/components/rich-quote-card'
import { RichInvoiceCard } from '@/components/rich-invoice-card'
import { RichScheduleCard } from '@/components/rich-schedule-card'
import { AudioPlayer } from '@/components/audio-player'
import type { QuoteMessage, Attachment, QuoteStatus, InvoiceStatus } from '@/lib/types'

function formatMessageTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

interface ChatMessageProps {
  message: QuoteMessage
  /** Whether this is being viewed by the electrician (true) or customer (false) */
  isOwnerView: boolean
  /** Show "Seen" indicator on this message (only on last consecutive read outbound) */
  showSeen?: boolean
  /** Link base for quote cards — differs for owner vs customer portal */
  quoteHref?: string
}

export function ChatMessage({ message, isOwnerView, showSeen, quoteHref }: ChatMessageProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const isOutbound = message.direction === 'outbound'
  const isNote = message.channel === 'note'
  const attachments = (message.attachments || []) as Attachment[]
  const meta = (message.metadata || {}) as Record<string, unknown>

  // In owner view: outbound = right aligned, inbound = left aligned
  // In customer view: outbound (from electrician) = left aligned, inbound (from customer) = right aligned
  const alignRight = isOwnerView ? isOutbound : !isOutbound

  if (isNote) {
    return (
      <div className="flex justify-center my-2">
        <div className="flex items-start gap-2 max-w-[85%] bg-sf-surface-2 border border-sf-border border-dashed rounded-[6px] px-3 py-2">
          <StickyNote size={14} className="text-sf-text-tertiary shrink-0 mt-0.5" strokeWidth={1.5} />
          <div>
            <div className="text-[11px] text-sf-text-tertiary mb-0.5">Internal note</div>
            <div className="text-[13px] text-sf-text-secondary whitespace-pre-wrap">{message.body}</div>
            <div className="text-[11px] text-sf-text-tertiary mt-1">{formatMessageTime(message.created_at)}</div>
          </div>
        </div>
      </div>
    )
  }

  // Rich quote card
  if (message.message_type === 'quote_card' && meta.quote_number) {
    return (
      <div className={cn('flex my-1.5', alignRight ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[80%]">
          <div className="text-[11px] text-sf-text-tertiary mb-1">{message.sender_name}</div>
          <RichQuoteCard
            quoteNumber={meta.quote_number as string}
            jobType={meta.job_type as string}
            total={meta.total as number}
            status={meta.status as QuoteStatus}
            href={quoteHref}
          />
          {message.body && (
            <div className="text-[13px] text-sf-text-primary whitespace-pre-wrap mt-1.5">{message.body}</div>
          )}
          <div className={cn('text-[11px] mt-1', alignRight ? 'text-sf-accent/60' : 'text-sf-text-tertiary')}>
            {formatMessageTime(message.created_at)}
          </div>
        </div>
      </div>
    )
  }

  // Rich invoice card
  if (message.message_type === 'invoice_card' && meta.invoice_number) {
    const invoiceHref = isOwnerView && meta.invoice_id ? `/invoices/${meta.invoice_id}` : undefined
    return (
      <div className={cn('flex my-1.5', alignRight ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[80%]">
          <div className="text-[11px] text-sf-text-tertiary mb-1">{message.sender_name}</div>
          <RichInvoiceCard
            invoiceNumber={meta.invoice_number as string}
            total={meta.total as number}
            status={meta.status as InvoiceStatus}
            href={invoiceHref}
          />
          {message.body && (
            <div className="text-[13px] text-sf-text-primary whitespace-pre-wrap mt-1.5">{message.body}</div>
          )}
          <div className={cn('text-[11px] mt-1', alignRight ? 'text-sf-accent/60' : 'text-sf-text-tertiary')}>
            {formatMessageTime(message.created_at)}
          </div>
        </div>
      </div>
    )
  }

  // Audio message
  if (message.message_type === 'audio' && attachments.length > 0) {
    return (
      <div className={cn('flex my-1.5', alignRight ? 'justify-end' : 'justify-start')}>
        <div className={cn('max-w-[80%] min-w-[220px] rounded-[8px] px-3 py-2', alignRight
          ? 'bg-sf-accent/10 border border-sf-accent/20'
          : 'bg-sf-surface-2 border border-sf-border'
        )}>
          <div className="text-[11px] text-sf-text-tertiary mb-1">{message.sender_name}</div>
          <AudioPlayer src={attachments[0].url} />
          <div className={cn('flex items-center gap-1 mt-1', alignRight ? 'justify-end' : '')}>
            <span className={cn('text-[11px]', alignRight ? 'text-sf-accent/60' : 'text-sf-text-tertiary')}>
              {formatMessageTime(message.created_at)}
            </span>
            {isOwnerView && isOutbound && message.channel === 'portal' && (
              message.read_at
                ? <CheckCheck size={12} className="text-sf-accent" strokeWidth={2} />
                : <Check size={12} className="text-sf-text-tertiary" strokeWidth={2} />
            )}
          </div>
          {showSeen && <div className="text-[10px] text-sf-text-tertiary text-right mt-0.5">Seen</div>}
        </div>
      </div>
    )
  }

  // Schedule card
  if (message.message_type === 'schedule_card' && meta.job_type) {
    return (
      <div className={cn('flex my-1.5', alignRight ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[80%]">
          <div className="text-[11px] text-sf-text-tertiary mb-1">{message.sender_name}</div>
          <RichScheduleCard
            jobType={meta.job_type as string}
            scheduledDate={meta.scheduled_date as string}
            startTime={meta.start_time as string | null}
            estimatedHours={meta.estimated_hours as number}
            address={meta.address as string | null}
          />
          {message.body && (
            <div className="text-[13px] text-sf-text-primary whitespace-pre-wrap mt-1.5">{message.body}</div>
          )}
          <div className={cn('text-[11px] mt-1', alignRight ? 'text-sf-accent/60' : 'text-sf-text-tertiary')}>
            {formatMessageTime(message.created_at)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex my-1.5', alignRight ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[80%] rounded-[8px] px-3 py-2', alignRight
        ? 'bg-sf-accent/10 border border-sf-accent/20'
        : 'bg-sf-surface-2 border border-sf-border'
      )}>
        <div className="text-[11px] text-sf-text-tertiary mb-0.5">{message.sender_name}</div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="mb-1.5">
            <AttachmentPreview
              attachments={attachments}
              onImageClick={(url) => setLightboxUrl(url)}
            />
          </div>
        )}

        {/* Text body */}
        {message.body && (
          <div className="text-[13px] text-sf-text-primary whitespace-pre-wrap">{message.body}</div>
        )}

        {/* Timestamp + read receipt */}
        <div className={cn('flex items-center gap-1 mt-1', alignRight ? 'justify-end' : '')}>
          <span className={cn('text-[11px]', alignRight ? 'text-sf-accent/60' : 'text-sf-text-tertiary')}>
            {formatMessageTime(message.created_at)}
          </span>
          {isOwnerView && isOutbound && message.channel === 'portal' && (
            message.read_at ? (
              <CheckCheck size={12} className="text-sf-accent" strokeWidth={2} />
            ) : (
              <Check size={12} className="text-sf-text-tertiary" strokeWidth={2} />
            )
          )}
        </div>

        {/* Seen label */}
        {showSeen && (
          <div className="text-[10px] text-sf-text-tertiary text-right mt-0.5">Seen</div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  )
}
