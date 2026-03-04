'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

/**
 * /auth/callback
 *
 * Supabase redirects here after verifying a recovery (password reset) link.
 * Handles both PKCE (?code=...) and implicit (#access_token=...) flows.
 */
export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    async function handleCallback() {
      // 1. PKCE flow — code in query string
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          router.replace('/reset-password')
          return
        }
      }

      // 2. Implicit flow — tokens in hash fragment
      const hash = window.location.hash.substring(1)
      if (hash) {
        const hashParams = new URLSearchParams(hash)
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (!error) {
            router.replace('/reset-password')
            return
          }
        }
      }

      // 3. Neither flow worked — redirect to login
      router.replace('/login?error=invalid_reset_link')
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-dvh flex items-center justify-center">
      <p className="text-[14px] text-sf-text-secondary">Verifying...</p>
    </div>
  )
}
