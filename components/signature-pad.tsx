'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import SignaturePadLib from 'signature_pad'

interface SignaturePadProps {
  onSubmit: (data: { signatureData: string; signatureName: string }) => void
  loading?: boolean
}

export function SignaturePad({ onSubmit, loading }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePadLib | null>(null)
  const [name, setName] = useState('')
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // High-DPI scaling
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    canvas.width = canvas.offsetWidth * ratio
    canvas.height = canvas.offsetHeight * ratio
    canvas.getContext('2d')?.scale(ratio, ratio)

    const pad = new SignaturePadLib(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(20, 20, 20)',
    })

    pad.addEventListener('endStroke', () => {
      setIsEmpty(pad.isEmpty())
    })

    padRef.current = pad

    return () => {
      pad.off()
    }
  }, [])

  const handleClear = useCallback(() => {
    padRef.current?.clear()
    setIsEmpty(true)
  }, [])

  const handleSubmit = useCallback(() => {
    if (!padRef.current || padRef.current.isEmpty() || !name.trim()) return
    const signatureData = padRef.current.toDataURL('image/png')
    onSubmit({ signatureData, signatureName: name.trim() })
  }, [name, onSubmit])

  const canSubmit = !isEmpty && name.trim().length > 0 && !loading

  return (
    <div className="space-y-4">
      {/* Canvas */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-2 font-semibold">
          Draw your signature
        </div>
        <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            className="w-full touch-none"
            style={{ height: 160 }}
          />
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="mt-1.5 text-[12px] text-gray-500 hover:text-gray-700 underline"
        >
          Clear signature
        </button>
      </div>

      {/* Typed name */}
      <div>
        <label
          htmlFor="signature-name"
          className="text-[11px] uppercase tracking-wider text-gray-500 mb-1 block font-semibold"
        >
          Full name
        </label>
        <input
          id="signature-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Type your full name"
          className="w-full h-10 px-3 border border-gray-300 rounded-lg text-[14px] text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
      </div>

      {/* Legal disclaimer */}
      <p className="text-[11px] text-gray-400 leading-relaxed">
        By clicking &ldquo;Accept &amp; Sign&rdquo; below, you confirm that the
        signature above is yours and that you agree to the scope and pricing
        detailed in this quote. This constitutes a legally binding electronic
        signature.
      </p>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full h-12 bg-green-600 hover:bg-green-700 text-white text-[16px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Signing...' : 'Accept & Sign'}
      </button>
    </div>
  )
}
