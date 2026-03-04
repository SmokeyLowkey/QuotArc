import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const protectedPaths = ['/home', '/quotes', '/customers', '/invoices', '/jobs', '/settings']
const authPaths = ['/login', '/signup']
const unverifiedAllowed = ['/verify-email']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Check if email is verified — Supabase metadata first, DB fallback if stale
  let isVerified = !!user?.user_metadata?.email_verified
  if (user && !isVerified) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email_verified')
      .eq('id', user.id)
      .single()
    if (profile?.email_verified) {
      isVerified = true
      // Sync stale metadata — fire-and-forget (admin SDK not available in middleware)
    }
  }

  // 1. No user + protected path → /login
  if (!user && protectedPaths.some(p => pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 2. User + not verified + protected path → /verify-email
  if (user && !isVerified && protectedPaths.some(p => pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/verify-email'
    if (user.email) url.searchParams.set('email', user.email)
    return NextResponse.redirect(url)
  }

  // 3. User + verified + auth/unverified paths → /home
  if (user && isVerified) {
    if (authPaths.some(p => pathname === p) || unverifiedAllowed.some(p => pathname === p)) {
      const url = request.nextUrl.clone()
      url.pathname = '/home'
      return NextResponse.redirect(url)
    }
  }

  // 4. User + not verified + auth pages (login/signup) → /verify-email
  if (user && !isVerified && authPaths.some(p => pathname === p)) {
    const url = request.nextUrl.clone()
    url.pathname = '/verify-email'
    if (user.email) url.searchParams.set('email', user.email)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|q/|api/|auth/verify).*)',
  ],
}
