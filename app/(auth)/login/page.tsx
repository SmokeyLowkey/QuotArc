'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      const msg = authError.message === 'Invalid login credentials'
        ? 'Wrong email or password. Please try again.'
        : authError.message
      setError(msg)
      toast.error(msg)
      setLoading(false)
      return
    }

    // Hard navigate so middleware sees the new auth cookies
    window.location.href = '/home'
  }

  return (
    <form onSubmit={handleLogin} className="flex flex-col gap-3">
      {error && (
        <div className="px-3 py-2 bg-sf-danger/10 border border-sf-danger/20 rounded-[4px] text-[13px] text-sf-danger">
          {error}
        </div>
      )}

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

      <div>
        <label className="block text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary mb-1.5">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="w-full h-10 px-3 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[14px] text-sf-text-primary placeholder:text-sf-text-tertiary focus:outline-none focus:ring-1 focus:ring-sf-accent"
          placeholder="••••••••"
        />
        <div className="text-right mt-1">
          <Link href="/forgot-password" className="text-[12px] text-sf-text-tertiary hover:text-sf-text-secondary">
            Forgot password?
          </Link>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-press h-10 mt-1 bg-sf-accent hover:bg-sf-accent-hover text-white text-[14px] font-medium rounded-[4px] transition-colors duration-120 disabled:opacity-50"
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>

      <p className="text-center text-[13px] text-sf-text-secondary mt-2">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-sf-accent hover:underline">
          Start free trial
        </Link>
      </p>
    </form>
  )
}
