import { NextRequest, NextResponse } from 'next/server'
import { sendPasswordResetEmail } from '@/lib/email'
import { getAuthAdmin } from '@/lib/supabase/auth-admin'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const email = body.email?.toLowerCase().trim()

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  try {
    const admin = getAuthAdmin()
    const { data, error } = await admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })

    if (!error && data?.properties?.action_link) {
      await sendPasswordResetEmail({
        to: email,
        resetUrl: data.properties.action_link,
      })
    }
    // Always return success — don't reveal whether email exists
  } catch (err) {
    console.error('Failed to send password reset email:', err)
  }

  return NextResponse.json({ success: true })
}
