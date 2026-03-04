'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/send-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <h2 className="font-heading text-[20px] font-semibold text-sf-text-primary mb-2">
          Check your email
        </h2>
        <p className="text-[14px] text-sf-text-secondary leading-relaxed mb-6">
          If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link. Check your inbox.
        </p>
        <Link href="/login" className="text-[13px] text-sf-accent hover:underline">
          Back to login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="mb-1">
        <h2 className="font-heading text-[20px] font-semibold text-sf-text-primary mb-1">
          Forgot your password?
        </h2>
        <p className="text-[13px] text-sf-text-secondary">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary mb-1.5">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoFocus
          className="w-full h-10 px-3 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[14px] text-sf-text-primary placeholder:text-sf-text-tertiary focus:outline-none focus:ring-1 focus:ring-sf-accent"
          placeholder="you@company.com"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-press h-10 mt-1 bg-sf-accent hover:bg-sf-accent-hover text-white text-[14px] font-medium rounded-[4px] transition-colors duration-120 disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Send Reset Link'}
      </button>

      <p className="text-center text-[13px] text-sf-text-secondary mt-2">
        Remember your password?{' '}
        <Link href="/login" className="text-sf-accent hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
