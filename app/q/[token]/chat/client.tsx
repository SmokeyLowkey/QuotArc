'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Send, FileText, Paperclip, Mic } from 'lucide-react'
import { ChatMessage } from '@/components/chat-message'
import { AttachmentPreviewStrip } from '@/components/attachment-preview'
import { VoiceRecorder } from '@/components/voice-recorder'
import type { QuoteMessage, Attachment } from '@/lib/types'

const POLL_INTERVAL = 3000

interface ChatPortalClientProps {
  token: string
  quoteNumber: string
  jobType: string
  status: string
  customerName: string
  companyName: string
  companyPhone: string | null
}

export function ChatPortalClient({
  token,
  quoteNumber,
  jobType,
  status,
  customerName,
  companyName,
  companyPhone,
}: ChatPortalClientProps) {
  const [messages, setMessages] = useState<QuoteMessage[]>([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isExpired = status === 'expired'

  const fetchMessages = useCallback(async () => {
    const res = await fetch(`/api/quotes/public/${token}/messages`)
    if (res.ok) {
      const data = await res.json()
      setMessages(data.messages)
    }
    setLoading(false)
  }, [token])

  // Mark outbound messages as read by customer (on mount + on new messages)
  const markRead = useCallback(async () => {
    await fetch(`/api/quotes/public/${token}/messages/read`, { method: 'PATCH' })
  }, [token])

  // Initial fetch + polling
  useEffect(() => {
    fetchMessages()
    markRead()
    const interval = setInterval(fetchMessages, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchMessages, markRead])

  // Mark read whenever new outbound messages appear
  useEffect(() => {
    const hasUnreadOutbound = messages.some(m => m.direction === 'outbound' && !m.read_at)
    if (hasUnreadOutbound) {
      markRead()
    }
  }, [messages, markRead])

  // Auto-scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`
    }
  }, [body])

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return
    setUploading(true)
    const newAttachments: Attachment[] = []

    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await fetch(`/api/quotes/public/${token}/upload`, {
          method: 'POST',
          body: formData,
        })
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
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [token])

  const handleSend = async () => {
    if ((!body.trim() && !pendingAttachments.length) || sending || isExpired) return

    setSending(true)
    const res = await fetch(`/api/quotes/public/${token}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: body.trim(),
        attachments: pendingAttachments.length ? pendingAttachments : undefined,
      }),
    })

    if (res.ok) {
      const newMsg = await res.json()
      setMessages(prev => [...prev, newMsg])
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

  const handleVoiceSend = useCallback(async (attachment: Attachment) => {
    setSending(true)
    const res = await fetch(`/api/quotes/public/${token}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: '',
        message_type: 'audio',
        attachments: [attachment],
      }),
    })
    if (res.ok) {
      const newMsg = await res.json()
      setMessages(prev => [...prev, newMsg])
    }
    setRecording(false)
    setSending(false)
  }, [token])

  return (
    <div className="flex flex-col min-h-dvh max-w-[600px] mx-auto w-full">
      {/* Header */}
      <div className="bg-gray-900 text-white px-4 py-4 shrink-0">
        <h1 className="text-[16px] font-bold">{companyName}</h1>
        {companyPhone && <p className="text-[12px] text-gray-400">{companyPhone}</p>}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[12px] text-gray-400 font-mono">{quoteNumber}</span>
          <span className="text-gray-600">&middot;</span>
          <span className="text-[12px] text-gray-400">{jobType}</span>
        </div>
      </div>

      {/* View Quote Link */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 shrink-0">
        <Link
          href={`/q/${token}`}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          <FileText size={14} strokeWidth={1.5} />
          View Quote Details
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-white">
        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-[13px]">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-[13px]">No messages yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {messages.map(msg => (
              <ChatMessage
                key={msg.id}
                message={msg}
                isOwnerView={false}
                quoteHref={`/q/${token}`}
              />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-gray-200 bg-white px-4 py-3 shrink-0">
        {isExpired ? (
          <div className="text-center py-2">
            <p className="text-gray-400 text-[13px]">This quote has expired. You can no longer reply.</p>
          </div>
        ) : (
          <>
            {recording ? (
              <VoiceRecorder
                onSend={handleVoiceSend}
                onCancel={() => setRecording(false)}
                uploadUrl={`/api/quotes/public/${token}/upload`}
                disabled={sending}
              />
            ) : (
              <>
                {/* Pending attachment previews */}
                {pendingAttachments.length > 0 && (
                  <div className="mb-2">
                    <AttachmentPreviewStrip
                      attachments={pendingAttachments}
                      onRemove={(i) => setPendingAttachments(prev => prev.filter((_, idx) => idx !== i))}
                    />
                  </div>
                )}
                <div className="flex items-end gap-2">
                  {/* Attach button */}
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
                    disabled={uploading}
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0 disabled:opacity-50"
                  >
                    <Paperclip size={16} strokeWidth={1.5} className={uploading ? 'animate-pulse' : ''} />
                  </button>

                  <textarea
                    ref={textareaRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your reply..."
                    disabled={sending}
                    rows={1}
                    className="flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-400 transition-colors disabled:opacity-50"
                  />

                  {/* Mic button */}
                  <button
                    type="button"
                    onClick={() => setRecording(true)}
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
                  >
                    <Mic size={16} strokeWidth={1.5} />
                  </button>

                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={(!body.trim() && !pendingAttachments.length) || sending}
                    className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40 shrink-0"
                  >
                    <Send size={15} strokeWidth={1.5} />
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 text-center shrink-0">
        <p className="text-[11px] text-gray-400">
          Powered by <span className="font-semibold">QuotArc</span>
        </p>
      </div>
    </div>
  )
}
