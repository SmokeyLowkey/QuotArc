'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const PROVINCES = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland & Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
]

const TAX_MAP: Record<string, number> = {
  AB: 0.05, NT: 0.05, NU: 0.05, YT: 0.05,
  BC: 0.12, MB: 0.12,
  SK: 0.11,
  ON: 0.13,
  QC: 0.14975,
  NB: 0.15, NL: 0.15, NS: 0.15, PE: 0.15,
}

export default function SignupPage() {
  const router = useRouter()
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [province, setProvince] = useState('AB')
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { company_name: companyName, province },
      },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    // Mark session as unverified so middleware blocks access to protected routes
    await supabase.auth.updateUser({ data: { email_verified: false } })

    // Set province + auto-derived tax rate on the profile
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          province,
          default_tax_rate: TAX_MAP[province] ?? 0.05,
        }),
      })
    } catch {
      // Non-critical
    }

    // Send verification email
    try {
      await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch {
      // Non-critical — user can resend from verify-email page
    }

    toast.success('Account created — check your email to verify!')
    router.push(`/verify-email?email=${encodeURIComponent(email)}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSignup} className="flex flex-col gap-3">
      <div>
        <label className="block text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary mb-1.5">
          Company Name
        </label>
        <input
          type="text"
          value={companyName}
          onChange={e => setCompanyName(e.target.value)}
          required
          autoFocus
          className="w-full h-10 px-3 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[14px] text-sf-text-primary placeholder:text-sf-text-tertiary focus:outline-none focus:ring-1 focus:ring-sf-accent"
          placeholder="Brandt Electric Ltd."
        />
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
          minLength={6}
          className="w-full h-10 px-3 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[14px] text-sf-text-primary placeholder:text-sf-text-tertiary focus:outline-none focus:ring-1 focus:ring-sf-accent"
          placeholder="••••••••"
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary mb-1.5">
          Province
        </label>
        <select
          value={province}
          onChange={e => setProvince(e.target.value)}
          className="w-full h-10 px-3 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[14px] text-sf-text-primary focus:outline-none focus:ring-1 focus:ring-sf-accent"
        >
          {PROVINCES.map(p => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-press h-10 mt-1 bg-sf-accent hover:bg-sf-accent-hover text-white text-[14px] font-medium rounded-[4px] transition-colors duration-120 disabled:opacity-50"
      >
        {loading ? 'Creating account...' : 'Start Free Trial'}
      </button>

      <p className="text-[11px] text-sf-text-tertiary text-center mt-1">
        Free for your first 10 quotes. No credit card required.
      </p>

      <p className="text-center text-[13px] text-sf-text-secondary mt-2">
        Already have an account?{' '}
        <Link href="/login" className="text-sf-accent hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
