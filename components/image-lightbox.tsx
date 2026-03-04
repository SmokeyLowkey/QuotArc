'use client'

import { useEffect, useCallback } from 'react'
import { X, Download } from 'lucide-react'

interface ImageLightboxProps {
  url: string
  onClose: () => void
}

export function ImageLightbox({ url, onClose }: ImageLightboxProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <Download size={18} strokeWidth={1.5} />
        </a>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <X size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* Image */}
      <img
        src={url}
        alt="Attachment"
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-[4px]"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
