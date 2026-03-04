import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

export class AuthError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'AuthError'
  }
}

/**
 * Get the authenticated user from the request cookies.
 * Throws AuthError if not authenticated.
 */
export async function requireUser(): Promise<User> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new AuthError()
  return user
}

/**
 * Helper to return a 401 JSON response.
 */
export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
