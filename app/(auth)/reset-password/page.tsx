'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
      } else {
        setDone(true)
      }
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <h2 className="font-heading text-[20px] font-semibold text-sf-text-primary mb-2">
          Password updated
        </h2>
        <p className="text-[14px] text-sf-text-secondary leading-relaxed mb-6">
          Your password has been changed successfully.
        </p>
        <Link
          href="/home"
          className="inline-block h-10 px-6 leading-10 bg-sf-accent hover:bg-sf-accent-hover text-white text-[14px] font-medium rounded-[4px] transition-colors duration-120"
        >
          Go to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="mb-1">
        <h2 className="font-heading text-[20px] font-semibold text-sf-text-primary mb-1">
          Set a new password
        </h2>
        <p className="text-[13px] text-sf-text-secondary">
          Choose a new password for your account.
        </p>
      </div>

      {error && (
        <div className="text-[13px] text-red-500 bg-red-500/10 border border-red-500/20 rounded-[4px] px-3 py-2">
          {error}
        </div>
      )}

      <div>
        <label className="block text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary mb-1.5">
          New Password
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoFocus
          minLength={8}
          className="w-full h-10 px-3 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[14px] text-sf-text-primary placeholder:text-sf-text-tertiary focus:outline-none focus:ring-1 focus:ring-sf-accent"
          placeholder="Min. 8 characters"
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary mb-1.5">
          Confirm Password
        </label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          minLength={8}
          className="w-full h-10 px-3 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[14px] text-sf-text-primary placeholder:text-sf-text-tertiary focus:outline-none focus:ring-1 focus:ring-sf-accent"
          placeholder="Confirm your password"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-press h-10 mt-1 bg-sf-accent hover:bg-sf-accent-hover text-white text-[14px] font-medium rounded-[4px] transition-colors duration-120 disabled:opacity-50"
      >
        {loading ? 'Updating...' : 'Update Password'}
      </button>
    </form>
  )
}
