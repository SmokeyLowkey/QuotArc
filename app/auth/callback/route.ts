import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /auth/callback
 *
 * Supabase redirects here after verifying a recovery (password reset) link.
 * Exchanges the auth code for a session, then redirects to /reset-password
 * so the user can choose a new password.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const redirectTo = request.nextUrl.clone()

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      redirectTo.pathname = '/reset-password'
      redirectTo.search = ''
      return NextResponse.redirect(redirectTo)
    }
  }

  // Failed or missing code — send to login with error
  redirectTo.pathname = '/login'
  redirectTo.search = '?error=invalid_reset_link'
  return NextResponse.redirect(redirectTo)
}
