'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  )
}

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const emailParam = searchParams.get('email')
  const [email, setEmail] = useState<string | null>(emailParam)
  const [cooldown, setCooldown] = useState(0)
  const [sending, setSending] = useState(false)

  // Fallback: try to get email from session if not in URL
  useEffect(() => {
    if (email) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email)
    })
  }, [email])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function handleResend() {
    if (!email) return
    setSending(true)
    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send')
      }
      toast.success('Verification email sent!')
      setCooldown(60)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send verification email')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-full bg-sf-accent/10 flex items-center justify-center mb-4">
        <Mail size={24} strokeWidth={1.5} className="text-sf-accent" />
      </div>

      <h2 className="text-[18px] font-semibold text-sf-text-primary mb-2">
        Check your email
      </h2>

      <p className="text-[13px] text-sf-text-secondary leading-relaxed mb-6">
        We sent a verification link to{' '}
        {email ? (
          <span className="font-medium text-sf-text-primary">{email}</span>
        ) : (
          'your email'
        )}
        . Click the link to verify your account.
      </p>

      <button
        onClick={handleResend}
        disabled={sending || cooldown > 0 || !email}
        className="btn-press h-10 w-full bg-sf-surface-2 border border-sf-border hover:bg-sf-surface-3 text-sf-text-primary text-[14px] font-medium rounded-[4px] transition-colors duration-120 disabled:opacity-50"
      >
        {sending
          ? 'Sending...'
          : cooldown > 0
            ? `Resend in ${cooldown}s`
            : 'Resend verification email'}
      </button>

      <p className="text-[11px] text-sf-text-tertiary mt-4">
        The link expires in 24 hours. Check your spam folder if you don&apos;t see it.
      </p>
    </div>
  )
}
