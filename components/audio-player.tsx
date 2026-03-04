'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AudioPlayerProps {
  src: string
  className?: string
}

export function AudioPlayer({ src, className }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  const formatTime = (secs: number) => {
    if (!isFinite(secs)) return '0:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTime = () => {
      setCurrentTime(audio.currentTime)
      setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0)
    }
    const onLoaded = () => setDuration(audio.duration)
    const onEnded = () => {
      setIsPlaying(false)
      setProgress(0)
      setCurrentTime(0)
    }

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      // Reset to beginning if playback ended
      if (audio.ended) {
        audio.currentTime = 0
      }
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false))
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audioRef.current.currentTime = pct * duration
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        onClick={togglePlay}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-sf-accent/20 text-sf-accent hover:bg-sf-accent/30 transition-colors shrink-0"
      >
        {isPlaying
          ? <Pause size={14} strokeWidth={2} />
          : <Play size={14} strokeWidth={2} fill="currentColor" className="ml-0.5" />
        }
      </button>

      <div className="flex-1 min-w-0">
        {/* Progress bar */}
        <div
          className="h-1.5 bg-sf-surface-2 rounded-full cursor-pointer"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-sf-accent rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        {/* Time */}
        <div className="flex justify-between mt-0.5">
          <span className="text-[10px] font-mono text-sf-text-tertiary">{formatTime(currentTime)}</span>
          <span className="text-[10px] font-mono text-sf-text-tertiary">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  )
}
