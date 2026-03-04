'use client'

import { useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function VerifySuccess({ message }: { message: string }) {
  // Sign out the stale session so user logs in fresh with updated metadata
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.signOut()
  }, [])

  return (
    <>
      <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 size={24} strokeWidth={1.5} className="text-emerald-500" />
      </div>
      <h2 className="text-[18px] font-semibold text-sf-text-primary mb-2">
        Email verified!
      </h2>
      <p className="text-[13px] text-sf-text-secondary mb-6">
        {message}
      </p>
      <a
        href="/login"
        className="btn-press inline-flex items-center justify-center h-10 w-full bg-sf-accent hover:bg-sf-accent-hover text-white text-[14px] font-medium rounded-[4px] transition-colors duration-120"
      >
        Sign in to QuotArc
      </a>
    </>
  )
}
