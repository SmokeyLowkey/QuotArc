'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Square, Send, X, Play, Pause } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Attachment } from '@/lib/types'

interface VoiceRecorderProps {
  onSend: (attachment: Attachment) => void | Promise<void>
  onCancel: () => void
  uploadUrl: string
  disabled?: boolean
}

type RecordingState = 'idle' | 'recording' | 'stopped'

export function VoiceRecorder({ onSend, onCancel, uploadUrl, disabled }: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle')
  const [duration, setDuration] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const blobRef = useRef<Blob | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const frozenDuration = useRef(0)
  const mimeTypeRef = useRef('audio/webm')

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const cleanupRecorder = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop() } catch { /* already stopped */ }
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
  }, [])

  const startRecording = useCallback(async () => {
    // Clean up any existing recorder first (handles Strict Mode double-mount)
    cleanupRecorder()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4'
        : 'audio/ogg'
      mimeTypeRef.current = mimeType

      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        if (chunksRef.current.length === 0) {
          toast.error('Recording was empty — try again')
          setState('idle')
          return
        }
        const blob = new Blob(chunksRef.current, { type: mimeType })
        blobRef.current = blob
        setPreviewUrl(URL.createObjectURL(blob))
        setState('stopped')
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setDuration(0)
      setState('recording')

      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1)
      }, 1000)
    } catch {
      toast.error('Microphone access denied')
    }
  }, [cleanupRecorder])

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    frozenDuration.current = duration
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state === 'recording') {
      recorder.stop()
    }
  }, [duration])

  const discard = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    blobRef.current = null
    setPreviewUrl(null)
    setDuration(0)
    setIsPlaying(false)
    setState('idle')
    onCancel()
  }, [previewUrl, onCancel])

  const send = useCallback(async () => {
    if (!blobRef.current || blobRef.current.size === 0) {
      toast.error('No audio recorded')
      return
    }
    setUploading(true)

    try {
      const ext = mimeTypeRef.current.includes('mp4') ? 'mp4'
        : mimeTypeRef.current.includes('ogg') ? 'ogg' : 'webm'
      const file = new File([blobRef.current], `voice-note.${ext}`, { type: mimeTypeRef.current })
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(uploadUrl, { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }))
        toast.error(err.error || 'Failed to upload audio')
        setUploading(false)
        return
      }

      const attachment: Attachment = await res.json()
      if (previewUrl) URL.revokeObjectURL(previewUrl)

      // Await onSend so parent finishes creating the message before we unmount
      await onSend(attachment)
      onCancel()
    } catch (err) {
      toast.error('Failed to send voice note')
    }
    setUploading(false)
  }, [uploadUrl, onSend, onCancel, previewUrl])

  const togglePreview = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !previewUrl) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      if (audio.ended) {
        audio.currentTime = 0
      }
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false))
    }
  }, [isPlaying, previewUrl])

  // Auto-start recording on mount
  useEffect(() => {
    if (state === 'idle') {
      startRecording()
    }
    return () => {
      cleanupRecorder()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  if (state === 'idle') {
    return (
      <div className="flex items-center gap-2 flex-1 text-[13px] text-sf-text-tertiary">
        Starting mic...
      </div>
    )
  }

  if (state === 'recording') {
    return (
      <div className="flex items-center gap-2 flex-1 bg-sf-surface-1 border border-red-500/30 rounded-[6px] px-3 py-2">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
        <span className="text-[13px] font-mono text-red-400 flex-1">{formatDuration(duration)}</span>
        <button
          type="button"
          onClick={stopRecording}
          className="flex items-center justify-center w-7 h-7 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
        >
          <Square size={12} strokeWidth={2} fill="currentColor" />
        </button>
      </div>
    )
  }

  // stopped — preview
  return (
    <div className="flex items-center gap-2 flex-1 bg-sf-surface-1 border border-sf-border rounded-[6px] px-3 py-2">
      {previewUrl && (
        <audio
          ref={audioRef}
          src={previewUrl}
          onEnded={() => setIsPlaying(false)}
        />
      )}
      <button
        type="button"
        onClick={togglePreview}
        className="flex items-center justify-center w-7 h-7 rounded-full bg-sf-surface-2 text-sf-text-secondary hover:text-sf-text-primary transition-colors shrink-0"
      >
        {isPlaying ? <Pause size={12} strokeWidth={2} /> : <Play size={12} strokeWidth={2} fill="currentColor" />}
      </button>
      <span className="text-[13px] font-mono text-sf-text-secondary flex-1">{formatDuration(frozenDuration.current)}</span>
      <button
        type="button"
        onClick={discard}
        className="flex items-center justify-center w-6 h-6 rounded-[4px] text-sf-text-tertiary hover:text-sf-text-secondary transition-colors"
      >
        <X size={14} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={send}
        disabled={uploading}
        className={cn(
          'flex items-center justify-center w-7 h-7 rounded-[6px] transition-colors',
          uploading ? 'bg-sf-surface-2 text-sf-text-tertiary' : 'bg-sf-accent text-white hover:bg-sf-accent/90'
        )}
      >
        <Send size={12} strokeWidth={1.5} />
      </button>
    </div>
  )
}
