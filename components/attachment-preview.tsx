'use client'

import { FileText, Download } from 'lucide-react'
import type { Attachment } from '@/lib/types'

interface AttachmentPreviewProps {
  attachments: Attachment[]
  onImageClick?: (url: string) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentPreview({ attachments, onImageClick }: AttachmentPreviewProps) {
  if (!attachments.length) return null

  const images = attachments.filter(a => a.type.startsWith('image/'))
  const files = attachments.filter(a => !a.type.startsWith('image/'))

  return (
    <div className="flex flex-col gap-1.5">
      {/* Image grid */}
      {images.length > 0 && (
        <div className={`grid gap-1 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onImageClick?.(img.url)}
              className="relative rounded-[6px] overflow-hidden bg-sf-surface-2 hover:opacity-90 transition-opacity cursor-pointer"
            >
              <img
                src={img.url}
                alt={img.name}
                className="w-full max-h-[200px] object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* File cards */}
      {files.map((file, i) => (
        <a
          key={i}
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-2.5 py-2 rounded-[6px] bg-sf-surface-2 border border-sf-border hover:bg-sf-surface-1 transition-colors"
        >
          <div className="w-8 h-8 rounded-[4px] bg-sf-danger/10 flex items-center justify-center shrink-0">
            <FileText size={16} className="text-sf-danger" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-sf-text-primary truncate">{file.name}</div>
            <div className="text-[11px] text-sf-text-tertiary">{formatFileSize(file.size)}</div>
          </div>
          <Download size={14} className="text-sf-text-tertiary shrink-0" strokeWidth={1.5} />
        </a>
      ))}
    </div>
  )
}

/** Compact preview strip for the composer (shows pending uploads before sending) */
export function AttachmentPreviewStrip({
  attachments,
  onRemove,
}: {
  attachments: Attachment[]
  onRemove: (index: number) => void
}) {
  if (!attachments.length) return null

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {attachments.map((att, i) => (
        <div
          key={i}
          className="relative shrink-0 rounded-[4px] border border-sf-border bg-sf-surface-2 overflow-hidden group"
        >
          {att.type.startsWith('image/') ? (
            <img src={att.url} alt={att.name} className="w-14 h-14 object-cover" />
          ) : (
            <div className="w-14 h-14 flex flex-col items-center justify-center">
              <FileText size={16} className="text-sf-danger" strokeWidth={1.5} />
              <span className="text-[9px] text-sf-text-tertiary mt-0.5 truncate max-w-[48px]">
                {att.name.split('.').pop()?.toUpperCase()}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute top-0 right-0 w-4 h-4 bg-sf-surface-0/80 text-sf-text-tertiary hover:text-sf-danger text-[10px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}
