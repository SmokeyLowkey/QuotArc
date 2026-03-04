'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, StickyNote, MessageSquare, Paperclip, Mic } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AttachmentPreviewStrip } from '@/components/attachment-preview'
import { QuickReplyBar } from '@/components/quick-reply-bar'
import { VoiceRecorder } from '@/components/voice-recorder'
import type { Attachment, QuickReplyTemplate } from '@/lib/types'

interface MessageComposerProps {
  onSend: (
    body: string,
    channel: 'portal' | 'note',
    attachments?: Attachment[],
    messageType?: string
  ) => Promise<boolean>
  disabled?: boolean
  /** Upload endpoint URL */
  uploadUrl?: string
  /** Quick reply templates — pass to show template bar */
  templates?: QuickReplyTemplate[]
  /** Token substitution values */
  templateVars?: Record<string, string>
}

export function MessageComposer({
  onSend,
  disabled,
  uploadUrl,
  templates,
  templateVars,
}: MessageComposerProps) {
  const [body, setBody] = useState('')
  const [channel, setChannel] = useState<'portal' | 'note'>('portal')
  const [sending, setSending] = useState(false)
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`
    }
  }, [body])

  const handleSend = async () => {
    if ((!body.trim() && !pendingAttachments.length) || sending || disabled) return

    setSending(true)
    const msgType = pendingAttachments.length > 0
      ? (pendingAttachments[0].type.startsWith('image/') ? 'image' : 'file')
      : 'text'

    const success = await onSend(body.trim(), channel, pendingAttachments, msgType)
    if (success) {
      setBody('')
      setPendingAttachments([])
    }
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || !uploadUrl) return

    setUploading(true)
    const newAttachments: Attachment[] = []

    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await fetch(uploadUrl, { method: 'POST', body: formData })
        if (res.ok) {
          const att = await res.json()
          newAttachments.push(att)
        }
      } catch {
        // Upload failed silently
      }
    }

    if (newAttachments.length) {
      setPendingAttachments(prev => [...prev, ...newAttachments])
    }
    setUploading(false)

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [uploadUrl])

  const handleTemplateSelect = (templateBody: string) => {
    let filled = templateBody
    if (templateVars) {
      for (const [key, value] of Object.entries(templateVars)) {
        filled = filled.replaceAll(`{${key}}`, value)
      }
    }
    setBody(filled)
    textareaRef.current?.focus()
  }

  const handleRemoveAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index))
  }

  // Drag-and-drop support
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files.length) {
      handleFileSelect(e.dataTransfer.files)
    }
  }, [handleFileSelect])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleVoiceSend = useCallback(async (attachment: Attachment) => {
    setSending(true)
    await onSend('', channel, [attachment], 'audio')
    setSending(false)
  }, [onSend, channel])

  return (
    <div
      className="border-t border-sf-border bg-sf-surface-0 p-3"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Quick reply templates */}
      {templates && templates.length > 0 && channel === 'portal' && (
        <div className="mb-2">
          <QuickReplyBar templates={templates} onSelect={handleTemplateSelect} />
        </div>
      )}

      {/* Channel toggle */}
      <div className="flex items-center gap-1 mb-2">
        <button
          type="button"
          onClick={() => setChannel('portal')}
          className={cn(
            'flex items-center gap-1 px-2 h-6 rounded-[4px] text-[11px] font-medium transition-colors duration-120',
            channel === 'portal'
              ? 'bg-sf-accent/10 text-sf-accent border border-sf-accent/30'
              : 'text-sf-text-tertiary hover:text-sf-text-secondary'
          )}
        >
          <MessageSquare size={12} strokeWidth={1.5} />
          Message
        </button>
        <button
          type="button"
          onClick={() => setChannel('note')}
          className={cn(
            'flex items-center gap-1 px-2 h-6 rounded-[4px] text-[11px] font-medium transition-colors duration-120',
            channel === 'note'
              ? 'bg-sf-surface-2 text-sf-text-primary border border-sf-border'
              : 'text-sf-text-tertiary hover:text-sf-text-secondary'
          )}
        >
          <StickyNote size={12} strokeWidth={1.5} />
          Note
        </button>
        {channel === 'note' && (
          <span className="text-[11px] text-sf-text-tertiary ml-1">Only you can see this</span>
        )}
      </div>

      {/* Pending attachment previews */}
      {pendingAttachments.length > 0 && (
        <div className="mb-2">
          <AttachmentPreviewStrip attachments={pendingAttachments} onRemove={handleRemoveAttachment} />
        </div>
      )}

      {/* Input + attach + mic + send */}
      <div className="flex items-end gap-2">
        {/* Attach button */}
        {uploadUrl && channel === 'portal' && !recording && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || disabled}
              className="flex items-center justify-center w-8 h-8 rounded-[6px] text-sf-text-tertiary hover:text-sf-text-secondary hover:bg-sf-surface-2 transition-colors shrink-0 disabled:opacity-50"
            >
              <Paperclip size={16} strokeWidth={1.5} className={uploading ? 'animate-pulse' : ''} />
            </button>
          </>
        )}

        {recording ? (
          <VoiceRecorder
            uploadUrl={uploadUrl!}
            onSend={handleVoiceSend}
            onCancel={() => setRecording(false)}
            disabled={disabled}
          />
        ) : (
          <>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={channel === 'portal' ? 'Type a message...' : 'Add a private note...'}
              disabled={disabled || sending}
              rows={1}
              className="flex-1 resize-none rounded-[6px] border border-sf-border bg-sf-surface-1 px-3 py-2 text-[13px] text-sf-text-primary placeholder:text-sf-text-tertiary focus:outline-none focus:border-sf-accent/50 transition-colors duration-120 disabled:opacity-50"
            />
            {/* Mic button */}
            {uploadUrl && channel === 'portal' && (
              <button
                type="button"
                onClick={() => setRecording(true)}
                disabled={disabled}
                className="flex items-center justify-center w-8 h-8 rounded-[6px] text-sf-text-tertiary hover:text-sf-text-secondary hover:bg-sf-surface-2 transition-colors shrink-0 disabled:opacity-50"
                title="Record voice note"
              >
                <Mic size={16} strokeWidth={1.5} />
              </button>
            )}
            <button
              type="button"
              onClick={handleSend}
              disabled={(!body.trim() && !pendingAttachments.length) || sending || disabled}
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-[6px] transition-colors duration-120 shrink-0',
                (body.trim() || pendingAttachments.length) && !sending
                  ? 'bg-sf-accent text-white hover:bg-sf-accent/90'
                  : 'bg-sf-surface-2 text-sf-text-tertiary'
              )}
            >
              <Send size={14} strokeWidth={1.5} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
